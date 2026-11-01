// The script pasted into AWS EC2's "User data" box (Advanced details) when creating the crawler server
// in Mumbai (ap-south-1; Ubuntu 24.04 on a t4g ARM instance). It installs Docker, writes the crawler's
// settings (readable by root only) and starts the crawler with a memory limit (the server may run other services),
// and an hourly update (cron runs Watchtower once — a long-running Watchtower stopped updating silently on 27 Oct).
export const CRAWLER_IMAGE = "ghcr.io/caankitgargsitools/dhandha-crawler:latest";

export function crawlerCloudInit({ supabaseUrl, publishableKey, ingestKey, image = CRAWLER_IMAGE, intervalHours = 3, maxPages = 20 }) {
  const clean = (v) => String(v).replace(/[^A-Za-z0-9_.:/=-]/g, "");
  return `#!/bin/bash
# Dhandha tender crawler — server setup (AWS Mumbai, Ubuntu 24.04; also Oracle Linux 8/9; x86 or ARM)
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
docker run -d --name crawler --init --restart unless-stopped --memory 1200m --memory-swap 1200m --env-file /opt/dhandha/crawler.env --shm-size=1g ${clean(image)}
docker rm -f watchtower 2>/dev/null || true
echo '17 * * * * root docker run --rm -e DOCKER_API_VERSION=1.44 -v /var/run/docker.sock:/var/run/docker.sock containrrr/watchtower --run-once --cleanup crawler >> /var/log/dhandha-update.log 2>&1' > /etc/cron.d/dhandha-update
chmod 644 /etc/cron.d/dhandha-update
echo "Dhandha crawler started. Logs: sudo docker logs -f crawler"
`;
}
