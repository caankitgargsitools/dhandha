// The script pasted into Oracle Cloud's "Initialization script" box when creating the crawler server.
// It installs Docker, writes the crawler's settings (readable by root only) and starts the crawler,
// plus Watchtower so the server picks up new crawler versions published by GitHub Actions.
export const CRAWLER_IMAGE = "ghcr.io/caankitgargsitools/dhandha-crawler:latest";

export function crawlerCloudInit({ supabaseUrl, publishableKey, ingestKey, image = CRAWLER_IMAGE, intervalHours = 3, maxPages = 20 }) {
  const clean = (v) => String(v).replace(/[^A-Za-z0-9_.:/=-]/g, "");
  return `#!/bin/bash
# Dhandha tender crawler — server setup (Ubuntu or Oracle Linux 8/9, x86 or ARM)
set -e
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y && apt-get install -y docker.io
else
  # Oracle Linux: Docker's own repository (replaces the preinstalled podman tools)
  dnf install -y dnf-plugins-core
  dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  dnf install -y --allowerasing docker-ce docker-ce-cli containerd.io
fi
systemctl enable --now docker
mkdir -p /opt/dhandha && cd /opt/dhandha
cat > crawler.env <<'ENV'
SUPABASE_URL=${clean(supabaseUrl)}
SUPABASE_PUBLISHABLE_KEY=${clean(publishableKey)}
INGEST_KEY=${clean(ingestKey)}
INTERVAL_HOURS=${Number(intervalHours) || 3}
MAX_PAGES=${Number(maxPages) || 20}
TZ=Asia/Kolkata
ENV
chmod 600 crawler.env
docker rm -f crawler 2>/dev/null || true
docker run -d --name crawler --restart unless-stopped --env-file /opt/dhandha/crawler.env --shm-size=1g ${clean(image)}
docker rm -f watchtower 2>/dev/null || true
docker run -d --name watchtower --restart unless-stopped --security-opt label=disable -e DOCKER_API_VERSION=1.44 -v /var/run/docker.sock:/var/run/docker.sock containrrr/watchtower --interval 3600 --cleanup crawler
echo "Dhandha crawler started. Logs: sudo docker logs -f crawler"
`;
}
