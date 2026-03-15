import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './tailwind.css';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
