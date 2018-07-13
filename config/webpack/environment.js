import postcssAutoprefixerPlugin from 'autoprefixer';
import postcssImportPlugin from 'postcss-import';
import postcssPresetEnvPlugin from 'postcss-preset-env';

export default class Environment {
  constructor(options) {
    this.development = true;
    this.production = false;
    this.server = false;
    this.docker = false;

    this.locales = ['de'];

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
    const {
      production,
      server,

      // @HACK
      // ExtractTextPlugin,
      MiniCssExtractPlugin,
    } = this;

    // if (!ExtractTextPlugin) {
    //   throw new Error('Need a valid ExtractTextPlugin fed into the environment object.');
    // }

    if (!MiniCssExtractPlugin) {
      throw new Error('Need a valid MiniCssExtractPlugin fed into the environment object.');
    }

    const cssLoaders = [
      {
        loader: 'css-loader',
        options: {
          importLoaders: 1,
          sourceMap: true,
          modules: false,
          localIdentName: production
            ? '[name]__[local]--[hash:base64:5]'
            : '[name]__[local]--[hash:base64:5]',
        },
      },
      {
        loader: 'postcss-loader',
        options: {
          ident: 'postcss',
          plugins: loader => [
            postcssImportPlugin({
              root: loader.resourcePath,
            }),
            postcssPresetEnvPlugin(),
            postcssAutoprefixerPlugin(),
          ],
          sourceMap: true,
        },
      },
    ].filter(loader => loader !== false);

    if (preprocessingLoaders && preprocessingLoaders.length > 0) {
      cssLoaders.push(
        {
          loader: 'resolve-url-loader',
          options: {
            fail: true,
            silent: false,
          },
        },
        ...preprocessingLoaders.map(loader => Object.assign({}, loader, {
          options: Object.assign({}, loader.options || {}, {
            sourceMap: true,
          }),
        })),
      );
    }

    if (!server) {
      // const fallback = {
      //   loader: 'style-loader',
      // };
      // cssLoaders = ExtractTextPlugin.extract({
      //   fallback,
      //   use: cssLoaders,
      // });
      cssLoaders.unshift(MiniCssExtractPlugin.loader);
    }

    return cssLoaders;
  }
}
