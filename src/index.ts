import { defineApp } from '@frontify/platform-app';

import { MetadataManager } from './components/metadata-manager';
import { settings } from './settings';
import '@frontify/fondue/style';
import 'tailwindcss/tailwind.css';

export default defineApp({
    app: MetadataManager,
    settings,
});
