import { toast } from "sonner";
import { errorMessage } from "./app-errors";

let installed = false;
/** Existing forms share Sonner; sanitize their errors at this single boundary. */
export function installSafeFeedback() {
  if (installed) return;
  installed = true;
  const original = toast.error;
  toast.error = (message, options) => original(
    typeof message === "string" ? errorMessage(new Error(message)) : errorMessage(message),
    { ...options, description: undefined },
  );
}