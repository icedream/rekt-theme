import {
  DefinePlugin,
  NamedModulesPlugin,
  HashedModuleIdsPlugin,
  LoaderOptionsPlugin,
  NoEmitOnErrorsPlugin,
  ProvidePlugin,

  optimize,
} from 'webpack';

import path from 'path';
import { isatty } from 'tty';
import chalk from 'chalk';
import _debug from 'debug';

import cssnano from 'cssnano';

import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HtmlPlugin from 'html-webpack-plugin';
import ProgressBarPlugin from 'progress-bar-webpack-plugin';
import OptimizeCssAssetsPlugin from 'optimize-css-assets-webpack-plugin';

import TerserPlugin from 'terser-webpack-plugin';

import postcssSafeParser from 'postcss-safe-parser';

import Environment from './config/webpack/environment';

const debug = _debug('webpack:config');
debug.generated = _debug('webpack:config:generated');

debug.generated('filename:', __filename);
debug.generated('dirname:', __dirname);

const {
  ModuleConcatenationPlugin,
} = optimize;

const dj = 'icedream';

export default (options, { mode }) => {
  const environment = new Environment();

  environment.input(options);
  environment.input(mode);

  debug.generated(environment);

  const {
    development,
    production,
    server,
    docker,
  } = environment;

  const baseOutputFilepath = 'static/theme/[type]/[filename]';
  const filenames = {
    css: '[name].[ext]',
    default: development
      ? '[name].dev.[ext]'
      // Always use a hash (in production) to prevent files with the same name causing issues
      : '[name].[chunkhash:8].[ext]',
  };

  function replaceField(string, name, value) {
    const retval = string.replace(new RegExp(`\\[${name}(.*?)\\]`), value);
    debug('replaceField:', { args: { string, name, value } }, string, '=>', retval);
    return retval;
  }

  function getOutputFilename(type) {
    let filename = baseOutputFilepath;
    switch (type) {
      case 'css':
        filename = replaceField(filename, 'type', type);
        break;
      default:
        filename = replaceField(filename, 'type', `${type}/${dj}`);
        break;
    }
    filename = replaceField(filename, 'filename', filenames[type] || filenames.default);
    return filename;
  }

  function getAssetOutputFilename(type) {
    let filename = getOutputFilename(type);
    filename = replaceField(filename, 'chunkhash', '[hash$1]');
    return filename;
  }

  const cssOutputFileName = getOutputFilename('css')
    .replace(/\[ext(.*?)\]/g, 'css');
    // .replace(/\[chunkhash(.*?)\]/g, '[contenthash$1]');
  const cssChunkOutputFileName = getOutputFilename('css')
    .replace(/\[chunkhash(.*?)\]/g, '[id$1]')
    .replace(/\[ext(.*?)\]/g, 'css');
  // NOTE - Z replaced the paths on his server with non-relative paths, so we're doing that here as well
  const cssOutputRebasePath = `/${path.relative(path.dirname(cssOutputFileName), '').replace(/\\/g, '/')}/`;
  // const cssOutputRebasePath = '../../../';

  // Default options for file-loader
  const getFileLoaderOptions = (type) => ({
    name: getAssetOutputFilename(type),
    publicPath: cssOutputRebasePath,
  });

  // Default options for url-loader
  const getUrlLoaderOptions = (type) => ({
    ...getFileLoaderOptions(type),
    // limit: 1, // Don't inline anything (but empty files) by default
    limit: 4 * 1024,
  });

  const config = {
    name: 'frontend',
    target: 'web',

    devServer: {
      // inline: true,
      // contentBase: path.join(__dirname, 'public'),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
      historyApiFallback: {
        index: '/',
      },
      hot: false,
      https: !docker,
      noInfo: false,
      overlay: true,
      publicPath: '',
      quiet: false,
      disableHostCheck: docker,
      watchOptions: {
        ignored: /node_modules/,
      },
      proxy: {
        '**': {
          target: 'https://rekt.fm',
          headers: {
            Host: 'rekt.fm',
          },
          secure: false,
        },
      },
    },

    module: {
      rules: [
        {
          test: /\.jsx?/i,
          include: [
            path.resolve(__dirname, 'src'),
          ],
          use: [
            {
              loader: 'babel-loader',
              options: {
                // Look for babel configuration in project directory
                babelrc: true,
                // Cache transformations to the filesystem (in default temp dir)
                cacheDirectory: true,
              },
            },
          ],
        },

        ...[
          /\.(gif|png|webp)$/i, // graphics
          /\.svg$/i, // svg
          /\.jpe?g$/i, // jpeg
        ].map((test) => ({
          test,
          use: [
            {
              loader: 'url-loader',
              options: {
                ...getUrlLoaderOptions('img'),
                // fallback: 'responsive-loader',
              },
            },
            {
              loader: 'image-webpack-loader',
              options: {
                mozjpeg: {
                  progressive: true,
                  quality: 80,
                },
                optipng: {
                  enabled: true,
                  optimizationLevel: 7,
                },
                pngquant: {
                  enabled: false,
                  quality: '65-85',
                  speed: 2,
                  strip: true,
                },
                gifsicle: {
                  interlaced: false,
                },
                disable: development,
              },
            },
          ],
        })),

        ...[
          /\.(mp4|ogg|webm)$/i, // video
          /\.(wav|mp3|m4a|aac|oga)$/i, // audio
        ].map((test) => ({
          test,
          loader: 'url-loader',
          options: getUrlLoaderOptions('media'),
        })),

        ...[
          /\.(eot|otf|ttf|woff|woff2)$/i, // fonts
        ].map((test) => ({
          test,
          loader: 'url-loader',
          options: getUrlLoaderOptions('font'),
        })),

        {
          test: /\.css$/,
          use: environment.styleLoaders(),
        },
        {
          test: /\.s[ac]ss$/,
          use: environment.styleLoaders({
            loader: 'sass-loader',
          }),
        },
        // {
        //   test: /\.styl$/,
        //   use: environment.styleLoaders({
        //     loader: 'stylus-loader',
        //   }),
        // },
      ],
      strictExportPresence: true,
    },

    output: {
      filename: replaceField(getOutputFilename('js'), 'ext', 'js'),
      chunkFilename: replaceField(getOutputFilename('js'), 'ext', 'js'),
      path: path.join(__dirname, 'dist'),
      publicPath: '',
      globalObject: 'this', // https://github.com/webpack-contrib/worker-loader/issues/142#issuecomment-385764803
    },

    plugins: [
      // Show progress as a bar during build
      isatty(1) && new ProgressBarPlugin({
        complete: chalk.white('\u2588'),
        incomplete: chalk.grey('\u2591'),
        format: `:bar ${chalk.cyan.bold(':percent')} Webpack build: ${chalk.grey(':msg')}`,
      }),

      // Enforce case-sensitive import paths
      new CaseSensitivePathsPlugin(),
      // Replace specified expressions with values
      new DefinePlugin({
        'process.env.__DEV__': JSON.stringify(development),
        'process.env.__PROD__': JSON.stringify(production),
        'process.env.__SERVER__': JSON.stringify(server),
        'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
      }),

      // Publish modules that are expected by other dependencies to be
      // registered on `window` global in respective expected way.
      new ProvidePlugin({
        jQuery: 'jquery',
        $: 'jquery',
        jquery: 'jquery',
      }),

      // Dev server build
      ...[
      // Hot module reloading
        // new HotModuleReplacementPlugin(),
        new NoEmitOnErrorsPlugin(),

        // Use paths as names when serving
        new NamedModulesPlugin(),

        // serve a copy of index.html which loads the theme
        new HtmlPlugin({
          template: path.join(__dirname, 'src', 'index.html'),
          filename: 'index.html',
          hash: false,
          inject: 'body',
          // compile: true,
          favicon: false,
          minify: production ? {
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true,
            // includeAutoGeneratedTags: false,
            collapseWhitespace: true,
          // conservativeCollapse: true,
          } : false,
          // cache: true,
          showErrors: true,
          chunks: 'all',
          excludeChunks: [],
          title: 'REKT Network',
          xhtml: false,
          chunksSortMode: 'dependency',
        }),
      ].filter(() => server),

      // Extract imported stylesheets out into .css files
      new MiniCssExtractPlugin({
        filename: cssOutputFileName,
        chunkFileName: cssChunkOutputFileName,
      }),

      // If we're generating an HTML file, we must be building a web app, so
      // configure deterministic hashing for long-term caching.

      // Generate stable module ids instead of having Webpack assign integers.
      // NamedModulesPlugin allows for easier debugging and
      // HashedModuleIdsPlugin does this without adding too much to bundle
      // size.
      development
        ? new NamedModulesPlugin()
        : new HashedModuleIdsPlugin(),

      // Production builds
      ...[
        new LoaderOptionsPlugin({ debug: false, minimize: true }),

        // Hoisting
        new ModuleConcatenationPlugin(),
      ].filter(() => production),

    ].filter((plugin) => plugin !== false),
    resolve: {
      extensions: [
        '.js', '.jsx',
      ],
    },
    resolveLoader: {
      modules: ['node_modules'],
    },
    optimization: {
      minimize: production,
      minimizer: [
        new TerserPlugin(),
        new OptimizeCssAssetsPlugin({
          cssProcessor: cssnano,
          cssProcessorOptions: {
            preset: 'advanced',
            parser: postcssSafeParser,
            discardComments: { removeAll: true },
          },
          canPrint: true,
        }),
      ],
    },
    devtool: server ? 'cheap-module-source-map' : 'source-map',
    entry: {
      [dj]: [
        path.join(__dirname, 'src'),
      ],
    },
  };

  debug.generated(config);

  return config;
};
