import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {
      // point at a stripped-down config so mkcert does not try to issue a cert
      // for the storybook server
      builder: { viteConfigPath: '.storybook/vite.config.ts' }
    }
  }
}

export default config
