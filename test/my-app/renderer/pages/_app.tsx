import type { AppProps } from 'next/app';
import '../styles/globals.css';
import AppLayout from './home';

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <AppLayout>
            <Component {...pageProps} />
        </AppLayout>
    );
}

export default MyApp;
