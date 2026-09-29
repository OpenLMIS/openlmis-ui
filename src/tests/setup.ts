import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { onlineManager } from '@tanstack/react-query';
import { afterEach } from 'vitest';

// A test that takes the app offline never leaves the next one offline too.
afterEach(() => onlineManager.setOnline(true));
