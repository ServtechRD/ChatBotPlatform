#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="${SCRIPT_DIR}"
CERT_FILE="${SSL_DIR}/fullchain.pem"
KEY_FILE="${SSL_DIR}/privkey.pem"
DAYS="${DAYS:-365}"

# Priority:
# 1) use user provided IP argument
# 2) detect primary outbound IPv4
# 3) fallback to first IP from hostname -I
TARGET_IP="${1:-}"
if [ -z "${TARGET_IP}" ]; then
  TARGET_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
fi
if [ -z "${TARGET_IP}" ]; then
  TARGET_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi

if [ -z "${TARGET_IP}" ]; then
  echo "Cannot detect host IP. Please run: $0 <ip-address>"
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required but not installed."
  exit 1
fi

mkdir -p "${SSL_DIR}"
umask 077

TMP_CONF="$(mktemp)"
cat > "${TMP_CONF}" <<EOF
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[ dn ]
C = TW
ST = Taiwan
L = Taipei
O = ChatBotPlatform
OU = Dev
CN = ${TARGET_IP}

[ v3_req ]
subjectAltName = @alt_names
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[ alt_names ]
IP.1 = ${TARGET_IP}
DNS.1 = localhost
IP.2 = 127.0.0.1
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -days "${DAYS}" \
  -config "${TMP_CONF}" \
  -extensions v3_req

rm -f "${TMP_CONF}"
chmod 600 "${KEY_FILE}"

echo "Self-signed certificate generated:"
echo "  key : ${KEY_FILE}"
echo "  cert: ${CERT_FILE}"
echo "  SAN IP: ${TARGET_IP}"
