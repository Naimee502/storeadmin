// GraphQL error codes from an Apollo error, whatever shape it arrives in.
//
// Apollo Client 4 throws CombinedGraphQLErrors, whose server errors sit on
// `.errors` — the v3 `.graphQLErrors` array no longer exists, so code that
// only looked there never saw codes like LOGIN_OTP_REQUIRED. Older shapes are
// still checked so this works with either.
const serverErrors = (err: any): any[] => [
  ...(Array.isArray(err?.errors) ? err.errors : []),
  ...(Array.isArray(err?.graphQLErrors) ? err.graphQLErrors : []),
  ...(Array.isArray(err?.networkError?.result?.errors) ? err.networkError.result.errors : []),
  ...(err?.extensions ? [err] : []),
];

export const gqlErrorCodes = (err: any): string[] =>
  serverErrors(err).map((e) => e?.extensions?.code).filter(Boolean);

/** The `extensions` of the first error carrying `code`, or null. */
export const gqlErrorExt = (err: any, code: string): Record<string, any> | null =>
  serverErrors(err).find((e) => e?.extensions?.code === code)?.extensions ?? null;
