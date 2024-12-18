import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import NoSSR from 'react-no-ssr';
import { AppProvider } from '../context/provider';
import '../styles/globals.css';

const AppLayout = dynamic(() => import('../components/layout'), { ssr: false });

const Loading = () => (<div>Loading...</div>);

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <AppProvider>
            <NoSSR onSSR={<Loading />}>
                <AppLayout>
                    <Component {...pageProps} />
                </AppLayout>
            </NoSSR>
        </AppProvider >
    );
}

export default MyApp;
