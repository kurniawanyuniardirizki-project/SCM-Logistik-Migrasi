const anonymousOperator = {
  id: 0,
  openId: "anonymous-operator",
  name: "Operations",
  email: null,
  loginMethod: "anonymous",
  role: "admin" as const,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(0),
};

export function useAuth() {
  return {
    user: anonymousOperator,
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: async () => anonymousOperator,
    logout: async () => undefined,
  };
}
