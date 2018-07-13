import {
  DefinePlugin,
  NamedModulesPlugin,
  HashedModuleIdsPlugin,
  LoaderOptionsPlugin,
  HotModuleReplacementPlugin,
  NoEmitOnErrorsPlugin,
  ProvidePlugin,

  optimize,
} from 'webpack';

import path from 'path';
import { isatty } from 'tty';
import chalk from 'chalk';
import _debug from 'debug';
// import slash from 'slash';

import cssnano from 'cssnano';

import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';
// import ExtractTextPlugin from 'extract-text-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HtmlPlugin from 'html-webpack-plugin';
import ProgressBarPlugin from 'progress-bar-webpack-plugin';
import UglifyJsPlugin from 'uglifyjs-webpack-plugin';
import OptimizeCssAssetsPlugin from 'optimize-css-assets-webpack-plugin';

import postcssSafeParser from 'postcss-safe-parser';

import Environment from './config/webpack/environment';

const debug = _debug('webpack:config');
debug.generated = _debug('webpack:config:generated');

debug.generated('filename:', __filename);
debug.generated('dirname:', __dirname);

const {
  ModuleConcatenationPlugin,
} = optimize;

export default (options, { mode }) => {
  const environment = new Environment({
    // @HACK
    // ExtractTextPlugin,
    MiniCssExtractPlugin,
  });

  environment.input(options);
  environment.input(mode);

  debug.generated(environment);

  const {
    development,
    production,
    server,
    docker,
  } = environment;

  const baseOutputFilename = development
    ? 'assets/dev/[name].dev.[ext]'
    // Always use a hash (in production) to prevent files with the same name causing issues
    : 'assets/prod/[chunkhash:2]/[name].[chunkhash:8].[ext]';

  const webpackChunkFilename = baseOutputFilename
    .replace(/\[ext(.*?)\]/g, 'js');
  const webpackOutputFilename = webpackChunkFilename;

  const assetOutputFilename = baseOutputFilename
    .replace(/\[chunkhash(.*?)\]/g, '[hash$1]');

  const cssOutputFileName = baseOutputFilename
    .replace(/\[ext(.*?)\]/g, 'css');
    // .replace(/\[chunkhash(.*?)\]/g, '[contenthash$1]');
  const cssChunkOutputFileName = baseOutputFilename
    .replace(/\[chunkhash(.*?)\]/g, '[id$1]')
    .replace(/\[ext(.*?)\]/g, 'css');
  // const cssOutputRebasePath = `${slash(path.relative(path.dirname(cssOutputFileName), ''))}/`;
  const cssOutputRebasePath = '/';

  // Default options for file-loader
  const fileLoaderOptions = {
    name: assetOutputFilename,
    publicPath: cssOutputRebasePath,
  };

  // Default options for url-loader
  const urlLoaderOptions = {
    ...fileLoaderOptions,
    // limit: 1, // Don't inline anything (but empty files) by default
    limit: 4 * 1024,
  };

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
      hot: true,
      https: !docker,
      noInfo: false,
      overlay: true,
      publicPath: '',
      quiet: false,
      disableHostCheck: docker,
      watchOptions: {
        ignored: /node_modules/,
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
                babelrc: false,
                // Cache transformations to the filesystem (in default temp dir)
                cacheDirectory: true,

                presets: [
                  ['babel-preset-env', {
                    targets: {
                      browsers: {},
                      uglify: false,
                    },
                    // spec: true,
                    // debug: development,
                    useBuiltIns: true,
                    modules: false, // do not transpile modules, webpack 2+ does that
                  }],
                ],
                plugins: [
                  'babel-plugin-transform-class-properties',
                  'babel-plugin-transform-object-rest-spread',
                  ['babel-plugin-transform-runtime', {
                    helpers: false,
                    polyfill: false,
                    regenerator: true,
                  }],
                  'babel-plugin-dynamic-import-webpack',
                ],
              },
            },
          ],
        },

        ...[
          /\.(gif|png|webp)$/i, // graphics
          /\.svg$/i, // svg
          /\.jpe?g$/i, // jpeg
        ].map(test => ({
          test,
          loader: 'url-loader',
          options: {
            ...urlLoaderOptions,
            fallback: 'responsive-loader',
          },
        })),

        ...[
          /\.(mp4|ogg|webm)$/i, // video
          /\.(eot|otf|ttf|woff|woff2)$/i, // fonts
          /\.(wav|mp3|m4a|aac|oga)$/i, // audio
        ].map(test => ({
          test,
          loader: 'url-loader',
          options: urlLoaderOptions,
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
      filename: webpackOutputFilename,
      chunkFilename: webpackChunkFilename,
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
        new HotModuleReplacementPlugin(),
        new NoEmitOnErrorsPlugin(),

        // Use paths as names when serving
        new NamedModulesPlugin(),
      ].filter(() => server),

      // If we're not serving, we're creating a static build
      ...[// Extract imported stylesheets out into .css files
        new MiniCssExtractPlugin({
          filename: cssOutputFileName,
          chunkFileName: cssChunkOutputFileName,
        }),
      ].filter(() => !server),

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

      new HtmlPlugin({
        template: path.join(__dirname, 'src', 'index.html'),
        filename: 'index.html',
        hash: false,
        inject: true,
        compile: true,
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
        cache: true,
        showErrors: true,
        chunks: 'all',
        excludeChunks: [],
        title: 'REKT Network',
        xhtml: false,
        chunksSortMode: 'dependency',
      }),
    ].filter(plugin => plugin !== false),
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
        new UglifyJsPlugin({
          parallel: true,
          uglifyOptions: {
            compress: {
              warnings: false,
            },
            output: {
              comments: false,
            },
          },
          sourceMap: true,
        }),
        new OptimizeCssAssetsPlugin({
          assetNameRegExp: /\.css$/gi,
          cssProcessor: cssnano,
          cssProcessorOptions: {
            parser: postcssSafeParser,
            discardComments: { removeAll: true },
          },
          canPrint: true,
        }),
      ],
    },
    devtool: server ? 'cheap-module-source-map' : 'source-map',
    entry: {
      app: [
        path.join(__dirname, 'src'),
      ],
    },
  };

  debug.generated(config);

  return config;
};
