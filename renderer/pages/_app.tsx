import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import AppLayout from '../components/layout';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <AppLayout>
            <Component {...pageProps} />
        </AppLayout>
    );
}

// Force MyApp to run on the client
export default dynamic(() => Promise.resolve(MyApp), { ssr: false });
