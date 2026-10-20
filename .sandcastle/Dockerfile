# Ubuntu 26.04 LTS (resolute), the release the owner's machine runs (OWNER DECISION, 2026-10-18),
# pinned to its multi-platform index digest (read from Docker Hub on 2026-10-18). Update the tag
# and digest together. Only amd64 is built: the Ubuntu snapshot service serves amd64 under
# /ubuntu, and nothing else here is pinned for another architecture.
FROM ubuntu:26.04@sha256:c098726dd9b9733f3e885f8de0ef375206a311b0a317eadc40d347b1115fb944

# Every apt package comes from one dated snapshot of the Ubuntu archive, so a rebuild installs the
# same versions (https://snapshot.ubuntu.com/, read 2026-10-18). The sources name the snapshot
# URL directly, so a missing snapshot fails the build instead of falling back to the live archive.
ARG UBUNTU_SNAPSHOT=20261010T000000Z
RUN test "$(dpkg --print-architecture)" = amd64 \
  && rm /etc/apt/sources.list.d/ubuntu.sources \
  && printf '%s\n' 'Types: deb' "URIs: https://snapshot.ubuntu.com/ubuntu/${UBUNTU_SNAPSHOT}/" \
    'Suites: resolute resolute-updates resolute-security' 'Components: main universe' \
    'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg' \
    > /etc/apt/sources.list.d/ubuntu-snapshot.sources

# The base image has no CA certificates, so the first fetch, of ca-certificates alone, cannot
# check the TLS peer. apt still verifies the snapshot's InRelease signature against
# ubuntu-keyring and every package hash, which is the same trust the default plain-HTTP archive
# gives. Every later fetch checks the peer.
RUN apt-get -o Acquire::https::Verify-Peer=false update \
  && apt-get -o Acquire::https::Verify-Peer=false install -y --no-install-recommends ca-certificates \
  && apt-get update \
  && apt-get install -y --no-install-recommends curl gh git jq python3 xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Node 24.22.0, matching .nvmrc, from nodejs.org. The checksum is the line for this file in
# https://nodejs.org/dist/v24.22.0/SHASUMS256.txt.asc, whose signature verified against the
# release key C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C on 2026-10-18.
ARG NODE_VERSION=24.22.0
ARG NODE_SHA256=cc2f601cee82d9a5a233302fe307abc600727035fd7d2c3a3571755989e95008
RUN curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
  && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum --check --strict \
  && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
  && rm /tmp/node.tar.xz \
  && node --version

# Claude Code at an exact version (released 2026-10-03) instead of whatever the install script
# serves.
RUN npm install --global --no-audit --no-fund @anthropic-ai/claude-code@2.1.289

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "ubuntu" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID ubuntu && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent ubuntu
USER ${AGENT_UID}:${AGENT_GID}

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
