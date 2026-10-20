import { Component, type ReactNode } from "react";

interface ModelErrorBoundaryProps {
    assetId: string;
    children: ReactNode;
}

interface ModelErrorBoundaryState {
    failed: boolean;
}

export default class ModelErrorBoundary extends Component<
    ModelErrorBoundaryProps,
    ModelErrorBoundaryState
> {
    state: ModelErrorBoundaryState = {
        failed: false
    };

    static getDerivedStateFromError(): ModelErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: Error) {
        console.error(
            "Failed to load project model:",
            this.props.assetId,
            error
        );
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}