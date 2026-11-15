// Exécuté avant que la page devienne interactive (convention Next) : les erreurs d'hydratation sont
// donc bien écoutées.
import { installErrorReporting } from "@/lib/client/error-reporting";

installErrorReporting();
