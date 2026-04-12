const AUTH_KEY = 'ticketing_user';

export function setCurrentUser(username: string): void {
  localStorage.setItem(AUTH_KEY, username);
}

export function getCurrentUser(): string | null {
  return localStorage.getItem(AUTH_KEY);
}

export function clearCurrentUser(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}
