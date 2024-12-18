import React, {
    Component,
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useReducer,
    useState,
} from 'react';

// ----------------------------
// TYPES & INTERFACES
// ----------------------------
interface GlobalState {
    theme: 'light' | 'dark';
    counter: number;
}

interface AppContextType {
    state: GlobalState;
    dispatch: React.Dispatch<any>;
    toggleTheme: () => void;
}

interface AppProviderProps {
    children: ReactNode;
}

// ----------------------------
// CONTEXT SETUP
// ----------------------------
const defaultState: GlobalState = {
    theme: 'light',
    counter: 0,
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

// ----------------------------
// REDUCER FOR GLOBAL STATE
// ----------------------------
const appReducer = (state: GlobalState, action: any): GlobalState => {
    switch (action.type) {
        case 'INCREMENT':
            return { ...state, counter: state.counter + 1 };
        case 'TOGGLE_THEME':
            return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
        default:
            return state;
    }
};

// ----------------------------
// ERROR BOUNDARY COMPONENT
// ----------------------------
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <div>Something went wrong. Reload the app!</div>;
        }
        return this.props.children;
    }
}

// ----------------------------
// PROVIDER COMPONENT
// ----------------------------
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, defaultState);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const toggleTheme = () => dispatch({ type: 'TOGGLE_THEME' });

    const contextValue: AppContextType = {
        state,
        dispatch,
        toggleTheme,
    };

    return (
        <ErrorBoundary>
            <AppContext.Provider value={contextValue}>
                {/* Prevent rendering SSR content */}
                {!isClient ? <div>Loading...</div> : children}
            </AppContext.Provider>
        </ErrorBoundary>
    );
};

// ----------------------------
// CUSTOM HOOK
// ----------------------------
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within AppProvider');
    return context;
};
