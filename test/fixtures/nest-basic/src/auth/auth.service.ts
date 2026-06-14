export interface AuthenticatedUser {
  id: string;
  roles: string[];
}

export class AuthService {
  currentUser(): AuthenticatedUser {
    return { id: "u1", roles: ["member"] };
  }
}
