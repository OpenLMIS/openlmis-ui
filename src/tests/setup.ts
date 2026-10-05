import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { onlineManager } from '@tanstack/react-query';
import { configure } from '@testing-library/react';
import { afterEach } from 'vitest';

configure({ asyncUtilTimeout: 10_000 });

afterEach(() => onlineManager.setOnline(true));
