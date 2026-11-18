import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  incidentId: string | null;
}

function createIncidentId(): string {
  const random =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
      : Math.random().toString(36).slice(2);
  return `HPC-${Date.now().toString(36)}-${random}`.toUpperCase();
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    incidentId: null,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true, incidentId: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const incidentId = createIncidentId();
    this.setState({ incidentId });
    console.error(`Uncaught error in component [${incidentId}]:`, error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 border-4 border-white dark:border-[#161614] shadow-xl">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-[#111111] dark:text-white mb-3">Oops! Une erreur s'est produite.</h2>
          <p className="text-sm text-[#888888] max-w-md mb-8">
            Ne vous inquiétez pas, notre système a intercepté l'erreur. Un simple rafraîchissement suffit généralement à corriger le problème.
          </p>
          <p className="text-xs text-[#888888] mb-8">
            Si le problème persiste, contactez le support en précisant l'heure de l'erreur
            {this.state.incidentId ? ` et la référence ${this.state.incidentId}` : ""}.
          </p>
          <Button 
            onClick={this.handleReload}
            className="rounded-full px-8 h-12 bg-[#111111] hover:bg-[#5B21B6] text-white font-bold transition-colors shadow-lg flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Recharger la page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
