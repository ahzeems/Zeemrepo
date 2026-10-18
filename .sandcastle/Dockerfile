# node:24-trixie, matching .nvmrc, pinned to its multi-platform index digest (read from Docker
# Hub on 2026-10-18). Update the tag and digest together. Trixie rather than bookworm because
# evals:test needs tarfile's extraction filters, which bookworm's Python 3.11.2 lacks.
FROM node:24-trixie@sha256:ff054b356ab93ed540518ca23cfcd9840e5256dd04db5a8d8afc43f4ecc7c9f8

# Install system dependencies; python3 runs the repository's evals:test.
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  python3 \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Claude Code at an exact version (released 2026-10-03) instead of whatever the install script
# serves. The base image and this are pinned; the Debian packages above come from the current
# trixie archive, so a rebuild can still produce a different image ID.
RUN npm install --global --no-audit --no-fund @anthropic-ai/claude-code@2.1.289

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node
USER ${AGENT_UID}:${AGENT_GID}

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
