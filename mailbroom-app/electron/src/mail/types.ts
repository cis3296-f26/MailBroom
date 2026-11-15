export interface ProviderConfig {
  host: string; //Server address
  port: number; //Server port
  user: string; //The user's email address
  pass: string; //User's application password
}

export interface UnsubscribeCandidate {
    email:     string; //Sender's email address
    name:      string; //Sender's name
    httpsUrl:  string; //Online link to unsubscribe (optional)
    mailtoUrl: string; //mailto link (optional)
}