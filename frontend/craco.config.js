const CracoLessPlugin = require('craco-less');

module.exports = {
    style: {
        postcssOptions: {
            plugins: [
                require('tailwindcss'),
                require('autoprefixer'),
            ],
        },
    },
    plugins: [
        {
            plugin: CracoLessPlugin,
            options: {
                lessLoaderOptions: {
                    lessOptions: {
                        modifyVars: {
                            '@font-family':'Chulabhorn',
                            '@font-size-base':'20px',
                            '@primary-color': '#1F3D7D',
                            '@btn-primary-color': '#fff',
                            '@btn-primary-bg': '#F36B21',
                            '@btn-font-style': 'medium',
                            '@border-radius-base':'8px',
                            '@btn-height-sm':'100%'
                        },
                        javascriptEnabled: true,
                    },
                },
            },
        },
    ],
};