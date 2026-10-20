import { Component, type ReactNode } from "react";

interface AdminModelErrorBoundaryProps {
    assetId: string;
    children: ReactNode;
}

interface AdminModelErrorBoundaryState {
    failed: boolean;
}

export default class AdminModelErrorBoundary extends Component<
    AdminModelErrorBoundaryProps,
    AdminModelErrorBoundaryState
> {
    state: AdminModelErrorBoundaryState = {
        failed: false
    };

    static getDerivedStateFromError(): AdminModelErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: Error) {
        console.error(
            "Failed to render admin project model:",
            this.props.assetId,
            error
        );
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}