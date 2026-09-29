import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { onlineManager } from '@tanstack/react-query';
import { afterEach } from 'vitest';

afterEach(() => onlineManager.setOnline(true));
