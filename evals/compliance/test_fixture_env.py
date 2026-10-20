"""The fixture-environment control for Python test code, and the Git containment it protects.

A test that spawns a child with the caller's environment acts on whatever repository inherited
GIT_* variables name: the hooked repository when the pre-push hook runs the tests from a linked
worktree (wiki lesson "Hook-run checks must preserve Git state"). So every child process in these
tests passes an env built by run_comply.isolated_env, which keeps no Git routing or configuration.
scripts/toolchain/fixture-env.test.ts is the TypeScript twin.

The check reads the syntax tree and covers the common forms, not every possible one. A spawner
function may only be called or bound to a plain name; passing it as a value, storing it or
star-importing its module is refused. An env name counts as isolated only when every assignment of
it in the nearest scope that binds it is an isolated_env call from run_comply and nothing there
writes into it or removes keys from it.
Not followed: a spawning module itself passed or stored (`s = subprocess`, then `s.run`), which the
confinement tests do legitimately; a mapping changed through another alias or a function; names
bound by `import ... as`, `except ... as`, `match` or a walrus inside a comprehension; isolated_env
or run_comply rebound; computed imports, sys.modules and event-loop or other spawn APIs not listed
in SPAWNERS; and calls of the exempt control. os.exec*e and os.posix_spawn take env positionally
and are always refused; spawn through subprocess instead. A spawner class in a type position
(isinstance, annotations) is refused too.
"""

import ast
import dataclasses
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Callable
from unittest import mock

import run_comply

HERE = Path(__file__).resolve().parent
SPAWNERS = {
    # create_subprocess_* also under subprocess, for the asyncio.subprocess chain.
    "subprocess": {"run", "Popen", "call", "check_call", "check_output", "getoutput", "getstatusoutput",
                   "create_subprocess_exec", "create_subprocess_shell"},
    "os": {"system", "popen", "posix_spawn", "posix_spawnp"},  # plus every exec* and spawn*
    "asyncio": {"create_subprocess_exec", "create_subprocess_shell"},
    "pty": {"spawn"},
}
ISOLATING_MODULE = "run_comply"
# Methods through which code can write into an environment mapping after it was built.
MUTATORS = {"update", "setdefault", "__setitem__", "__ior__", "pop", "popitem", "clear", "__delitem__"}
# Scopes as Python resolves names: a class body is not visible from the methods inside it.
FUNCTION_SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
SCOPES = (ast.Module, ast.ClassDef, *FUNCTION_SCOPES)
# The decoy control below must inherit the caller's environment to show the hazard. It is the one
# function the check skips: a top-level function of this name, in this file only.
UNSAFE_CONTROL = ("test_fixture_env.py", "unsafe_run")


@dataclasses.dataclass
class Imports:
    spawners: set[str] = dataclasses.field(default_factory=set)  # names bound to a spawner
    modules: dict[str, str] = dataclasses.field(default_factory=dict)  # alias -> spawning module
    isolating: set[str] = dataclasses.field(default_factory=set)  # names bound to isolated_env
    isolating_modules: set[str] = dataclasses.field(default_factory=set)  # aliases of run_comply
    star: list[ast.ImportFrom] = dataclasses.field(default_factory=list)  # from <spawning module> import *


def is_spawner(module: str, name: str) -> bool:
    return name in SPAWNERS.get(module, set()) or (module == "os" and name.startswith(("exec", "spawn")))


def module_of(node: ast.expr, imports: Imports) -> str | None:
    """The spawning module `node` names: an import alias, or an attribute such as run_comply.subprocess."""
    if isinstance(node, ast.Name):
        return imports.modules.get(node.id)
    return node.attr if isinstance(node, ast.Attribute) and node.attr in SPAWNERS else None


def refers_to_spawner(node: ast.AST, imports: Imports) -> bool:
    if isinstance(node, ast.Name):
        return node.id in imports.spawners
    if isinstance(node, ast.Attribute):
        module = module_of(node.value, imports)
        return module is not None and is_spawner(module, node.attr)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "getattr" and len(node.args) >= 2:
        module, name = module_of(node.args[0], imports), node.args[1]
        return module is not None and isinstance(name, ast.Constant) and isinstance(name.value, str) and is_spawner(module, name.value)
    return False


def read_imports(tree: ast.Module) -> Imports:
    imports = Imports()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top = alias.name.split(".")[0]  # `import os.path` binds os
                if alias.asname is None and top in SPAWNERS:
                    imports.modules[top] = top
                elif alias.name in SPAWNERS:
                    imports.modules[alias.asname or alias.name] = alias.name
                if alias.name == ISOLATING_MODULE:
                    imports.isolating_modules.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom) and (node.module or "").split(".")[0] in SPAWNERS:
            module = (node.module or "").split(".")[0]  # asyncio.subprocess counts as asyncio
            imports.star.extend([node] if any(alias.name == "*" for alias in node.names) else [])
            imports.spawners.update(alias.asname or alias.name for alias in node.names if is_spawner(module, alias.name))
        elif isinstance(node, ast.ImportFrom) and node.module == ISOLATING_MODULE:
            imports.isolating.update(alias.asname or alias.name for alias in node.names if alias.name == "isolated_env")
    return imports


def alias_targets(node: ast.AST) -> list[str]:
    """The plain names an assignment binds, when it binds nothing else."""
    if isinstance(node, ast.Assign) and all(isinstance(target, ast.Name) for target in node.targets):
        return [target.id for target in node.targets if isinstance(target, ast.Name)]
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value is not None:
        return [node.target.id]
    return []


def follow_aliases(tree: ast.Module, imports: Imports) -> None:
    """`run = subprocess.run` (annotated or not, and aliases of aliases) makes `run` a spawner too."""
    assignments = [node for node in ast.walk(tree) if alias_targets(node)]
    size = -1
    while size != len(imports.spawners):
        size = len(imports.spawners)
        for node in assignments:
            if refers_to_spawner(node.value, imports):  # type: ignore[attr-defined]
                imports.spawners.update(alias_targets(node))


def is_isolated_env_call(node: ast.AST | None, imports: Imports) -> bool:
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if isinstance(func, ast.Name):
        return func.id in imports.isolating
    return (isinstance(func, ast.Attribute) and func.attr == "isolated_env"
            and isinstance(func.value, ast.Name) and func.value.id in imports.isolating_modules)


def own_nodes(scope: ast.AST) -> list[ast.AST]:
    """The nodes of `scope`, not those inside the scopes nested in it."""
    found: list[ast.AST] = []
    pending = list(ast.iter_child_nodes(scope))
    while pending:
        node = pending.pop()
        found.append(node)
        if not isinstance(node, SCOPES):
            pending.extend(ast.iter_child_nodes(node))
    return found


def isolated_stores(nodes: list[ast.AST], imports: Imports) -> set[int]:
    """Ids of the Name targets assigned an isolated_env call directly: `env = run_comply.isolated_env(...)`."""
    stores: set[int] = set()
    for node in nodes:
        targets = node.targets if isinstance(node, ast.Assign) else [node.target] if isinstance(node, (ast.AnnAssign, ast.NamedExpr)) else []
        if targets and is_isolated_env_call(getattr(node, "value", None), imports):
            stores.update(id(target) for target in targets if isinstance(target, ast.Name))
    return stores


def tainted_names(scope: ast.AST, nodes: list[ast.AST]) -> set[str]:
    """Names bound in `scope` other than by an assignment: parameters, nested definitions, global and
    nonlocal declarations, and mappings written into after they were built."""
    names = {arg.arg for arg in ast.walk(scope.args) if isinstance(arg, ast.arg)} if isinstance(scope, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)) else set()
    for node in nodes:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(node.name)
        elif isinstance(node, (ast.Global, ast.Nonlocal)):
            names.update(node.names)
        elif isinstance(node, ast.Subscript) and isinstance(node.ctx, (ast.Store, ast.Del)) and isinstance(node.value, ast.Name):
            names.add(node.value.id)
        elif (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in MUTATORS
              and isinstance(node.func.value, ast.Name)):
            names.add(node.func.value.id)
    return names


def isolated_bindings(scope: ast.AST, imports: Imports) -> dict[str, bool]:
    """For each name `scope` binds: whether every binding of it there is an untouched isolated_env call."""
    nodes = own_nodes(scope)
    stores = isolated_stores(nodes, imports)
    bound = dict.fromkeys(tainted_names(scope, nodes), False)
    for node in nodes:
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            bound[node.id] = bound.get(node.id, True) and id(node) in stores
    return bound


def is_isolated_name(name: str, scopes: list[ast.AST], imports: Imports) -> bool:
    """The nearest enclosing scope that binds `name` decides, as Python's own lookup does."""
    for scope in scopes:
        bound = isolated_bindings(scope, imports)
        if name in bound:
            return bound[name]
    return False


def passes_clean_env(call: ast.Call, scopes: list[ast.AST], imports: Imports) -> bool:
    return any(keyword.arg == "env" and (is_isolated_env_call(keyword.value, imports)
                                          or (isinstance(keyword.value, ast.Name) and is_isolated_name(keyword.value.id, scopes, imports)))
               for keyword in call.keywords)


def nodes_with_context(tree: ast.Module) -> list[tuple[ast.AST, ast.AST, list[ast.AST]]]:
    """Every node with its parent and its enclosing scopes, innermost first."""
    found: list[tuple[ast.AST, ast.AST, list[ast.AST]]] = []
    pending: list[tuple[ast.AST, list[ast.AST]]] = [(tree, [tree])]
    while pending:
        node, scopes = pending.pop()
        for child in ast.iter_child_nodes(node):
            found.append((child, node, scopes))
            if isinstance(child, FUNCTION_SCOPES):
                pending.append((child, [child, *(scope for scope in scopes if not isinstance(scope, ast.ClassDef))]))
            else:
                pending.append((child, [child, *scopes] if isinstance(child, ast.ClassDef) else scopes))
    return found


def loads_spawner_module_dynamically(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    loader = (isinstance(func, ast.Name) and func.id == "__import__") or (isinstance(func, ast.Attribute) and func.attr == "import_module")
    first = node.args[0] if node.args else None
    return loader and isinstance(first, ast.Constant) and first.value in SPAWNERS


def exempt_lines(tree: ast.Module, path: str) -> set[int]:
    if Path(path).name != UNSAFE_CONTROL[0]:
        return set()
    first = next((node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == UNSAFE_CONTROL[1]), None)
    return set() if first is None else set(range(first.lineno, (first.end_lineno or first.lineno) + 1))


def is_loaded(node: ast.AST) -> bool:
    return isinstance(node, ast.Call) or isinstance(getattr(node, "ctx", None), ast.Load)


def offends(node: ast.AST, parent: ast.AST, scopes: list[ast.AST], imports: Imports) -> bool:
    """A spawn without an isolated env, or a spawner used any way but as a call or a plain alias."""
    if loads_spawner_module_dynamically(node):
        return True
    if isinstance(node, ast.Call) and refers_to_spawner(node.func, imports) and not passes_clean_env(node, scopes, imports):
        return True
    if not (is_loaded(node) and refers_to_spawner(node, imports)):
        return False
    called = isinstance(parent, ast.Call) and parent.func is node
    aliased = bool(alias_targets(parent)) and getattr(parent, "value", None) is node
    return not (called or aliased)


def unscrubbed_spawns(path: str, source: str) -> list[str]:
    tree = ast.parse(source, filename=path)
    imports = read_imports(tree)
    follow_aliases(tree, imports)
    exempt = exempt_lines(tree, path)
    lines = [node.lineno for node in imports.star]
    lines += [node.lineno for node, parent, scopes in nodes_with_context(tree)  # type: ignore[attr-defined]
              if offends(node, parent, scopes, imports) and node.lineno not in exempt]  # type: ignore[attr-defined]
    return [f"{path}:{line}" for line in sorted(lines)]


class SpawnCheck(unittest.TestCase):
    def test_sees_through_renames_and_aliases_and_accepts_only_an_isolated_env(self) -> None:
        offending = [
            "import subprocess\nsubprocess.run(['git', 'init'])",
            # The A02 omission: a setup callback that hands the caller's environment to every command.
            "import subprocess\nrun = lambda args, **kw: subprocess.run(args, **kw)",
            "import subprocess as sp\nsp.Popen(['sh', '-c', 'git init'])",
            "from subprocess import check_output as co\nco(['git', 'status'])",
            "import os, subprocess\nsubprocess.run(args, env=os.environ)",
            "import os, subprocess\nsubprocess.run(args, env=dict(os.environ))",
            "import os, subprocess\nenv = dict(os.environ)\nsubprocess.run(args, env=env)",
            "import os, subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\nenv = dict(os.environ)\nsubprocess.run(args, env=env)",
            "import subprocess\nrun = subprocess.run\nagain = run\nagain(['git'])",
            "import os\nos.system('git init')",
            "from os import execvp\nexecvp('git', ['git'])",
            "import subprocess\nsubprocess.getoutput('git status')",
            "import importlib\nimportlib.import_module('subprocess')",
            "__import__('os')",
            "import subprocess\ndef unsafe_run(args):\n    return subprocess.run(args)",
            "import os, subprocess, run_comply\ndef a():\n    env = dict(os.environ)\n    subprocess.run(x, env=env)\n"
            "def b():\n    env = run_comply.isolated_env(o, g)\n    subprocess.run(x, env=env)",
            # A spawner handed over as a value runs later with whatever environment its caller gives it.
            "import subprocess, run_comply\nrun_comply.setup_sandbox(b, c, subprocess.run, w)",
            "import subprocess\ndef f(run=subprocess.run):\n    run(x)",
            "import subprocess\nclass T:\n    def setUp(self):\n        self.run = subprocess.run",
            "import subprocess\nrunners = {'git': subprocess.run}",
            "import subprocess\nfrom typing import Callable\nrun: Callable[..., object] = subprocess.run\nrun(['git'])",
            "from subprocess import *\nrun(['git'])",
            "import asyncio\nasyncio.create_subprocess_exec('git')",
            "import run_comply\nrun_comply.subprocess.run(['git'])",
            "import subprocess\ngetattr(subprocess, 'run')(['git'])",
            # An isolated env stops being one once something writes into it or a nearer name shadows it.
            "import subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\nenv['GIT_DIR'] = d\nsubprocess.run(x, env=env)",
            "import os, subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\nenv.update(os.environ)\nsubprocess.run(x, env=env)",
            "import subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\ndef git_in(path, env):\n    subprocess.run(['git'], cwd=path, env=env)",
            "import subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\nrun = lambda args, env: subprocess.run(args, env=env)",
            "import subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\ndef f(envs):\n    for env in envs:\n        subprocess.run(x, env=env)",
            "import os, subprocess, run_comply\nenv = dict(os.environ)\nclass T:\n    env = run_comply.isolated_env(b, g)\n"
            "    def m(self):\n        subprocess.run(x, env=env)",
            "import subprocess\nsubprocess.run(x, env=other.isolated_env(b, g))",
            "import os.path\nos.system('git init')",
            "import asyncio\nasyncio.subprocess.create_subprocess_exec('git')",
            "from asyncio.subprocess import create_subprocess_exec\ncreate_subprocess_exec('git')",
            "import pty\npty.spawn(['git'])",
            "import subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\nenv.pop('GIT_CONFIG_GLOBAL')\nsubprocess.run(x, env=env)",
            "import subprocess, run_comply\nenv = run_comply.isolated_env(b, g)\ndel env['GIT_CONFIG_NOSYSTEM']\nsubprocess.run(x, env=env)",
        ]
        for source in offending:
            self.assertEqual(len(unscrubbed_spawns("sample.py", source)), 1, source)
        unsafe = "import subprocess\ndef unsafe_run(a):\n    return subprocess.run(a)\n"
        self.assertEqual(unscrubbed_spawns("test_fixture_env.py", unsafe), [], "the one exempt control, at top level here")
        self.assertEqual(len(unscrubbed_spawns("test_fixture_env.py", unsafe + "class T:\n    def unsafe_run(self, a):\n"
                                                                          "        return subprocess.run(a)\n")), 1,
                         "a second function of that name elsewhere in the file is not exempt")
        self.assertEqual(len(unscrubbed_spawns("test_fixture_env.py", unsafe + unsafe)), 1, "only the first top-level definition is")
        clean = [
            "import os, subprocess, run_comply\nsubprocess.run(args, env=run_comply.isolated_env(dict(os.environ), g))",
            "import os, subprocess, run_comply\nenv = run_comply.isolated_env(dict(os.environ), g)\nrun = lambda args, **kw: subprocess.run(args, env=env, **kw)",
            "from run_comply import isolated_env\nimport subprocess\nsubprocess.Popen(cmd, env=isolated_env(base, g))",
            "import os\nos.path.join('a', 'b')",
            "import subprocess, run_comply\ndef t():\n    env = run_comply.isolated_env(o, g)\n"
            "    def inner():\n        return subprocess.run(x, env=env)",
            "import subprocess as sp, run_comply as rc\nenv: dict[str, str] = rc.isolated_env(b, g)\nsp.run(x, env=env)",
            "from run_comply import isolated_env as clean\nimport subprocess\nsubprocess.run(x, env=clean(b, g))",
            "import subprocess\nfrom unittest import mock\nwith mock.patch.object(subprocess, 'run'):\n    pass",
        ]
        for source in clean:
            self.assertEqual(unscrubbed_spawns("sample.py", source), [], source)

    def test_every_child_process_spawned_by_these_tests_passes_an_isolated_env(self) -> None:
        offenders = [found for path in sorted(HERE.glob("test_*.py"))
                     for found in unscrubbed_spawns(path.name, path.read_text())]
        self.assertEqual(offenders, [])


def untainted() -> dict[str, str]:
    return {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}


def tree_state(root: Path) -> dict[str, tuple[int, bytes]]:
    """Mode and content of every path under `root`: HEAD, refs, config, index and working files alike."""
    state = {}
    for path in sorted(root.rglob("*")):
        content = os.readlink(path).encode() if path.is_symlink() else path.read_bytes() if path.is_file() else b""
        state[path.relative_to(root).as_posix()] = (path.lstat().st_mode, content)
    return state


def make_decoy(root: Path) -> Path:
    decoy = root / "decoy"
    decoy.mkdir()
    env = run_comply.isolated_env(untainted(), root / "gh")
    git = lambda *args: subprocess.run(["git", *args], cwd=decoy, env=env, check=True, capture_output=True)
    git("init", "--quiet")
    (decoy / "tracked.txt").write_text("decoy\n")
    git("add", "tracked.txt")
    git("commit", "--quiet", "-m", "decoy")
    return decoy


def decoy_routing(decoy: Path) -> dict[str, str]:
    """What a hook or a parent session can leave in the environment: routing plus injected configuration."""
    return {
        "GIT_DIR": str(decoy / ".git"), "GIT_WORK_TREE": str(decoy), "GIT_INDEX_FILE": str(decoy / ".git" / "index"),
        "GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "fixture.injected", "GIT_CONFIG_VALUE_0": "count",
        "GIT_CONFIG_PARAMETERS": "'fixture.parameter'='parameters'",
    }


# Neither control reads the owner's global or system git configuration.
NO_USER_CONFIG = {"GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
# The ticket keeps the unsafe control away from a real hook: when the suite itself runs with routing
# set (the pre-push hook from a linked worktree), the control is skipped and CI runs it.
UNDER_HOOK = any(key in os.environ for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"))
SETUP = ("git config fixture.marker set", "printf 'made\\n' > made.txt", "git add made.txt",
         "git config --get-regexp '^fixture[.]' > seen.txt; true")


def unsafe_run(args: list[str], **kwargs: object) -> object:
    """The callback A02 found: the caller's environment, so inherited routing reaches the decoy."""
    return subprocess.run(args, **kwargs)  # type: ignore[call-overload]


class DecoyContainment(unittest.TestCase):
    def setup_under_decoy_routing(self, root: Path, run_for: Callable[[], Callable[..., object]]) -> list[str]:
        messages: list[str] = []
        with mock.patch.dict(os.environ, {**untainted(), **NO_USER_CONFIG, **decoy_routing(root / "decoy")}, clear=True):
            run = run_for()
            run_comply.setup_sandbox(root / "box", SETUP, run, messages.append)
            run_comply.commit_baseline(root / "box", run)
        return messages

    @unittest.skipIf(UNDER_HOOK, "the unsafe control does not run under a hook that routes Git")
    def test_the_caller_s_environment_lets_setup_reach_a_decoy_named_by_inherited_routing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            before = tree_state(make_decoy(root))
            try:
                self.setup_under_decoy_routing(root, lambda: unsafe_run)
            except subprocess.CalledProcessError:
                pass  # the baseline may refuse once routing has pointed it elsewhere; the decoy is what matters
            self.assertNotEqual(tree_state(root / "decoy"), before, "the unsafe callback is a real control: it reaches the decoy")
            seen = (root / "box" / "seen.txt").read_text()
            self.assertIn("fixture.injected count", seen, "GIT_CONFIG_COUNT injection reaches an unscrubbed setup command")
            self.assertIn("fixture.parameter parameters", seen, "GIT_CONFIG_PARAMETERS injection does too")

    def test_an_isolated_env_initialises_the_fixture_and_leaves_the_decoy_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            before = tree_state(make_decoy(root))

            def isolated() -> Callable[..., object]:
                env = run_comply.isolated_env(dict(os.environ), root / "gh")
                return lambda args, **kw: subprocess.run(args, env=env, **kw)

            messages = self.setup_under_decoy_routing(root, isolated)
            self.assertEqual(tree_state(root / "decoy"), before, "HEAD, refs, config, index and files of the decoy are unchanged")
            self.assertEqual(messages, [], "every setup command succeeded in the fixture")
            box_env = run_comply.isolated_env(untainted(), root / "gh")
            git = lambda *args: subprocess.run(["git", *args], cwd=root / "box", env=box_env, check=True, capture_output=True, text=True).stdout.strip()
            self.assertEqual(git("config", "--get", "fixture.marker"), "set")
            self.assertEqual(git("ls-files"), "made.txt\nseen.txt")
            self.assertEqual((root / "box" / "seen.txt").read_text(), "fixture.marker set\n", "injected configuration is dropped")
            self.assertEqual(git("rev-parse", "HEAD"), git("rev-parse", "refs/remotes/origin/main"))


if __name__ == "__main__":
    unittest.main()
