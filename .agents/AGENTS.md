# Project Customization & Infrastructure Rules

## 🖥️ Oracle Cloud VPS Reference & Credentials

### Access & SSH Details
- **Host / IP:** `144.33.22.54` (Oracle Cloud Infrastructure)
- **SSH User:** `ubuntu`
- **Primary SSH Key:** `d:\sites\Novo-emprega-pe\ssh-key.pem`
- **Backup Key Path:** `C:\Users\Alessandro\OneDrive\Área de Trabalho\oracle agente\private_key.pem`
- **SSH Command:**
  ```powershell
  ssh -i "d:\sites\Novo-emprega-pe\ssh-key.pem" -o StrictHostKeyChecking=no ubuntu@144.33.22.54
  ```

### Server Specifications
- **OS:** Ubuntu 22.04 LTS (x86_64 / Oracle Always Free Micro)
- **Disk Storage:** 45 GB Total (/dev/sda1) — 31 GB Free
- **RAM / Swap:** 1.0 GB RAM + 2.0 GB Swap (~450 MB RAM available)

### Running Services & Background Automation
- **Oracle ARM VPS Bot:** `oracle-bot.service` (`/home/ubuntu/oracle-agente/criar_vps_oracle.py`) — Runs 24/7 scanning every 30s to claim an Always Free 24 GB ARM instance.
- **PM2 Apps:** Process `0: emprega-pe` at `/home/ubuntu/apps/Novo-emprega-pe-main`.
- **Cron Jobs:** Instagram Agent, Sync Jobs, Concursos Agent.
