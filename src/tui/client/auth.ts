type AuthStore = {
  readonly getToken: () => string | null
  readonly setToken: (token: string) => void
  readonly getHeaders: () => Record<string, string>
}

export const createAuthStore = (): AuthStore => {
  const state = { token: null as string | null }

  return {
    getToken: () => state.token,
    setToken: (token) => { state.token = token },
    getHeaders: (): Record<string, string> => ({
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    }),
  }
}
