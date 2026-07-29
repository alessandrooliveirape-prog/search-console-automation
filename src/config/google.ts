import { google } from "googleapis";
import { env } from "./env";

export const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: env.GOOGLE_REFRESH_TOKEN,
});

export const searchconsole = google.searchconsole({
  version: "v1",
  auth: oauth2Client,
});
