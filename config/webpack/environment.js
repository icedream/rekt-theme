import postcssAutoprefixerPlugin from 'autoprefixer';
import postcssImportPlugin from 'postcss-import';
import postcssPresetEnvPlugin from 'postcss-preset-env';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

export default class Environment {
  constructor(options = {}) {
    this.development = true;
    this.production = false;
    this.server = false;
    this.docker = false;

    if (options !== undefined && options !== null) {
      this.input(options);
    }
  }

  input(options) {
    if (options) {
      switch (true) {
        case typeof (options) === 'string': // string
          this.inputString(options);
          break;

        case Array.isArray(options): // array
          options.forEach((arg) => { this.input(arg); });
          break;

        default: // object
          Object.keys(options).forEach((k) => {
            this[k] = options[k] || this[k];
          });
          break;
      }
    } else if (process.env.NODE_ENV) {
      this.inputString(process.env.NODE_ENV);
    }
  }

  inputString(env) {
    switch (env.toLowerCase()) {
      case 'development':
        this.development = true;
        this.production = false;
        break;
      case 'production':
        this.development = false;
        this.production = true;
        break;
      case 'server':
        this.server = true;
        break;
      case 'docker':
        this.docker = true;
        break;
      default:
        console.warn('Unknown environment:', env);
        break;
    }
  }

  styleLoaders(...preprocessingLoaders) {
    const cssLoaders = [
      {
        loader: 'css-loader',
        options: {
          importLoaders: 1,
          sourceMap: true,
          modules: false,
          // localIdentName: production
          //   ? '[name]__[local]--[hash:base64:5]'
          //   : '[name]__[local]--[hash:base64:5]',
        },
      },
      {
        loader: 'postcss-loader',
        options: {
          ident: 'postcss',
          plugins: (loader) => [
            postcssImportPlugin({
              root: loader.resourcePath,
            }),
            postcssPresetEnvPlugin(),
            postcssAutoprefixerPlugin(),
          ],
          sourceMap: true,
        },
      },
    ].filter((loader) => loader !== false);

    if (preprocessingLoaders && preprocessingLoaders.length > 0) {
      cssLoaders.push(
        {
          loader: 'resolve-url-loader',
          options: {
            silent: false,
          },
        },
        ...preprocessingLoaders.map((loader) => ({
          ...loader,
          options: { ...loader.options || {}, sourceMap: true },
        })),
      );
    }

    // if (!server) {
    // const fallback = {
    //   loader: 'style-loader',
    // };
    // cssLoaders = ExtractTextPlugin.extract({
    //   fallback,
    //   use: cssLoaders,
    // });
    // cssLoaders.unshift(MiniCssExtractPlugin.loader);
    cssLoaders.unshift({
      loader: MiniCssExtractPlugin.loader,
      options: {
        hmr: this.server,
        // reloadAll: true,
      },
    });
    // }

    return cssLoaders;
  }
}
