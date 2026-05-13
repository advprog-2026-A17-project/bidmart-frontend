import { Component, type ErrorInfo, type ReactNode } from 'react';

interface GlobalErrorBoundaryProps {
    children: ReactNode;
}

interface GlobalErrorBoundaryState {
    hasError: boolean;
    message: string;
}

class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
    state: GlobalErrorBoundaryState = {
        hasError: false,
        message: '',
    };

    static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
        return {
            hasError: true,
            message: error.message || 'Unexpected application error',
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('BidMart UI crashed:', error, errorInfo);
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="page-wrap">
                <section className="panel center-content" role="alert">
                    <h1>Something went wrong</h1>
                    <p className="text-muted">
                        Refresh the page or return to the auction catalogue.
                    </p>
                    <div className="toast-error">{this.state.message}</div>
                    <button className="primary-button" type="button" onClick={() => window.location.assign('/')}>
                        Back to Catalogue
                    </button>
                </section>
            </div>
        );
    }
}

export default GlobalErrorBoundary;
