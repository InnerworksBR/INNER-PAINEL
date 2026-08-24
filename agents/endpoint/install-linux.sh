#!/bin/bash
# install-linux.sh
# Script de Instalação do Agente de Máquina Inner para Linux (systemd)

echo "======================================================"
echo "   🚀 INSTALADOR DO AGENTE DE MÁQUINA PORTAL INNER"
echo "======================================================"
echo ""

API_URL=$1
ACTIVATION_TOKEN=$2

if [ -z "$API_URL" ]; then
    read -p "Informe a URL da API do Portal (Ex: https://painel.suaempresa.com/api): " API_URL
fi

if [ -z "$ACTIVATION_TOKEN" ]; then
    read -p "Informe a Chave/Token de Ativação da Empresa: " ACTIVATION_TOKEN
fi

if [ -z "$API_URL" ] || [ -z "$ACTIVATION_TOKEN" ]; then
    echo "[ERRO] URL da API e Token de Ativação são obrigatórios."
    exit 1
fi

HOSTNAME=$(hostname)
OS_INFO=$(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')

echo "Conectando ao Portal Inner em: $API_URL ..."
echo "Registrando máquina '$HOSTNAME' ($OS_INFO)..."

RESPONSE=$(curl -s -X POST "$API_URL/agent/enroll" \
  -H "Content-Type: application/json" \
  -d '{
    "activation_token": "'"$ACTIVATION_TOKEN"'",
    "agent_type": "endpoint",
    "hostname": "'"$HOSTNAME"'",
    "os_info": "'"$OS_INFO"'",
    "version": "1.0.0"
  }')

ASSET_KEY=$(echo "$RESPONSE" | grep -o '"asset_key":"[^"]*' | cut -d'"' -f4)
AGENT_SECRET=$(echo "$RESPONSE" | grep -o '"agent_secret":"[^"]*' | cut -d'"' -f4)

if [ -z "$ASSET_KEY" ] || [ -z "$AGENT_SECRET" ]; then
    echo "[ERRO] Falha no registro. Resposta da API:"
    echo "$RESPONSE"
    exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONFIG_PATH="$SCRIPT_DIR/config.json"

cat <<EOF > "$CONFIG_PATH"
{
  "api_url": "$API_URL",
  "asset_key": "$ASSET_KEY",
  "agent_secret": "$AGENT_SECRET",
  "hostname": "$HOSTNAME"
}
EOF

echo ""
echo "=========================================================="
echo " 🎉 AGENTE DE MÁQUINA INSTALADO COM SUCESSO!"
echo "=========================================================="
echo ""
echo " 🔑 CHAVE DO ATIVO GERADA PARA O PORTAL:"
echo "    >>> $ASSET_KEY <<<"
echo ""

# Criar serviço systemd se for root
if [ "$EUID" -eq 0 ]; then
    echo "Configurando serviço systemd 'inner-agent'..."
    cat <<EOF > /etc/systemd/system/inner-agent.service
[Unit]
Description=Portal Inner Endpoint Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/node $SCRIPT_DIR/inner-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable inner-agent
    systemctl start inner-agent
    echo "[OK] Serviço 'inner-agent' iniciado com sucesso!"
else
    echo "Executando em segundo plano (para serviço permanente, rode como root)..."
    nohup node "$SCRIPT_DIR/inner-agent.js" > "$SCRIPT_DIR/agent.log" 2>&1 &
fi

echo "[PRONTO] Agente de Máquina está em execução!"
