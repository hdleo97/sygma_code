import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "./app-errors";

export function createAppQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error) => toast.error(errorMessage(error)) }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.options.onError) toast.error(errorMessage(error));
      },
    }),
    defaultOptions: { queries: { retry: 1 }, mutations: { retry: false } },
  });
}