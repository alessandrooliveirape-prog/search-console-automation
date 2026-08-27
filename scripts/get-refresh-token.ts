import { google } from "googleapis";
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import "dotenv/config";

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback";

if (!clientID || !clientSecret) {
  console.error("Erro: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET precisam estar definidos no arquivo .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectUri);

const scopes = [
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/webmasters.readonly"
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
  prompt: "consent"
});

console.log("====================================================");
console.log("Autorização Google Search Console");
console.log("====================================================");
console.log("Abra o seguinte URL no seu navegador para autorizar o app:");
console.log(authUrl);
console.log("====================================================");

// Tenta abrir o navegador automaticamente
try {
  const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${startCmd} "${authUrl}"`);
} catch (e) {
  // Ignora se falhar
}

// Inicia um servidor HTTP local para capturar a resposta
const parsedRedirect = new url.URL(redirectUri);
const port = parseInt(parsedRedirect.port || "3000", 10);

const server = http.createServer(async (req, res) => {
  try {
    if (req.url && req.url.startsWith(parsedRedirect.pathname)) {
      const q = url.parse(req.url, true).query;
      if (q.code) {
        const code = q.code as string;
        const { tokens } = await oauth2Client.getToken(code);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Autorização concluída!</h1><p>Você pode fechar esta aba e retornar ao terminal.</p>");
        
        if (tokens.refresh_token) {
          console.log("\n====================================================");
          console.log("TOKEN DE ATUALIZAÇÃO (REFRESH TOKEN) ENCONTRADO:");
          console.log("====================================================");
          console.log(tokens.refresh_token);
          console.log("====================================================");

          // Escreve automaticamente no arquivo .env
          const envPath = path.resolve(process.cwd(), ".env");
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, "utf8");
            if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
              envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
            } else {
              envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
            }
            fs.writeFileSync(envPath, envContent, "utf8");
            console.log("✅ Token salvo AUTOMATICAMENTE no seu arquivo .env!");
          } else {
            console.log("⚠️ Arquivo .env não encontrado. Crie-o e insira GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
          }
        } else {
          console.warn("⚠️ Nenhum refresh_token retornado pelo Google. Tente revogar os acessos da app em https://myaccount.google.com/permissions e execute novamente.");
        }
        
        server.close(() => {
          process.exit(0);
        });
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Erro: código de autorização não encontrado.");
      }
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Não encontrado.");
    }
  } catch (error) {
    console.error("Erro ao obter o token:", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Erro interno do servidor.");
    process.exit(1);
  }
});

server.listen(port, () => {
  console.log(`Aguardando resposta do Google em http://localhost:${port}...`);
});
