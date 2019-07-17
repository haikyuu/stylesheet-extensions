import Layer from "zeplin-extension-style-kit/elements/layer";
import FontFace from "zeplin-extension-style-kit/elements/fontFace";
import TextStyle from "zeplin-extension-style-kit/elements/textStyle";
import Color from "zeplin-extension-style-kit/values/color";
import Mixin from "zeplin-extension-style-kit/declarations/mixin";
import RuleSet from "zeplin-extension-style-kit/ruleSet";
import {
    isHtmlTag,
    getUniqueLayerTextStyles,
    getFontFaces,
    selectorize,
    getResources,
    getResourceContainer
} from "zeplin-extension-style-kit/utils";

import SassGenerator from "./generator";
import { COPYRIGHT, LANG, OPTION_NAMES } from "./constants";

function getVariableMap(containerColors, params) {
    const variables = {};

    containerColors.forEach(containerColor => {
        // Colors are sorted by their priorities; so, we don't override already set colors
        const colorValue = new Color(containerColor).valueOf();
        variables[colorValue] = variables[colorValue] ? variables[colorValue] : containerColor.name;
    });

    return variables;
}

function createGenerator(context, params) {
    const { container, type } = getResourceContainer(context)
    const containerColors = getResources(container, type, params.useLinkedStyleguides, "colors");
    return new SassGenerator(getVariableMap(containerColors, params), params);
}

function getParams(context) {
    const { container } = getResourceContainer(context);
    return {
        densityDivisor: container.densityDivisor,
        useLinkedStyleguides: context.getOption(OPTION_NAMES.USE_LINKED_STYLEGUIDES),
        colorFormat: context.getOption(OPTION_NAMES.COLOR_FORMAT),
        useMixin: context.getOption(OPTION_NAMES.MIXIN),
        showDimensions: context.getOption(OPTION_NAMES.SHOW_DIMENSIONS),
        showDefaultValues: context.getOption(OPTION_NAMES.SHOW_DEFAULT_VALUES),
        unitlessLineHeight: context.getOption(OPTION_NAMES.UNITLESS_LINE_HEIGHT)
    };
}

function colors(context) {
    const params = getParams(context);
    const sassGenerator = createGenerator(context, params);
    const { container, type } = getResourceContainer(context);
    const allColors = getResources(container, type, params.useLinkedStyleguides, "colors");

    return {
        code: allColors.map(c => sassGenerator.variable(c.name, new Color(c))).join("\n"),
        language: LANG
    };
}

function textStyles(context) {
    const params = getParams(context);
    const sassGenerator = createGenerator(context, params);
    const { container, type } = getResourceContainer(context);
    const textStyles = getResources(container, type, params.useLinkedStyleguides, "textStyles");
    const fontFaces = getFontFaces(allTextStyles);

    const fontFaceCode = fontFaces.map(ts => {
        const { style } = new FontFace(ts);

        return sassGenerator.atRule(style);
    }).join("\n\n");

    const textStyleCode = textStyles.map(t => {
        const { style } = new TextStyle(t);

        return sassGenerator.ruleSet(style, { mixin: params.useMixin });
    }).join("\n\n");

    return {
        code: `${fontFaceCode}\n\n${textStyleCode}`,
        language: LANG
    };
}

function layer(context, selectedLayer) {
    const params = getParams(context);
    const { useMixin } = params;
    const sassGenerator = createGenerator(context, params);
    const { container } = getResourceContainer(context);

    const l = new Layer(selectedLayer);
    const layerRuleSet = l.style;
    const childrenRuleSet = [];
    const { defaultTextStyle } = selectedLayer;

    if (selectedLayer.type === "text" && defaultTextStyle) {
        const containerTextStyle = container.findTextStyleEqual(defaultTextStyle, params.useLinkedStyleguides);
        const declarations = l.getLayerTextStyleDeclarations(defaultTextStyle);
        let textStyleName;

        if (containerTextStyle) {
            textStyleName = containerTextStyle.name;
        }

        if (useMixin && textStyleName && !isHtmlTag(selectorize(textStyleName))) {
            const mixinRuleSet = new RuleSet("mixin", l.getLayerTextStyleDeclarations(containerTextStyle));

            declarations.forEach(d => {
                if (!mixinRuleSet.hasProperty(d.name)) {
                    layerRuleSet.addDeclaration(d);
                }
            });

            layerRuleSet.addDeclaration(new Mixin(selectorize(textStyleName).replace(/^\./, "")));
        } else {
            declarations.forEach(d => layerRuleSet.addDeclaration(d));
        }

        getUniqueLayerTextStyles(selectedLayer).filter(
            textStyle => !defaultTextStyle.equals(textStyle)
        ).forEach((textStyle, idx) => {
            childrenRuleSet.push(
                new RuleSet(
                    `${selectorize(selectedLayer.name)} ${selectorize(`text-style-${idx + 1}`)}`,
                    l.getLayerTextStyleDeclarations(textStyle)
                )
            );
        });
    }

    const layerStyle = sassGenerator.ruleSet(layerRuleSet);
    const childrenStyles = childrenRuleSet.map(
        s => sassGenerator.ruleSet(s, { parentDeclarations: layerRuleSet.declarations })
    );

    return {
        code: [layerStyle, ...childrenStyles].join("\n\n"),
        language: LANG
    };
}

function comment(context, text) {
    return `/* ${text} */`;
}

function exportColors(context) {
    const { code: colorCode, language } = colors(context);
    const code = `${comment(context, COPYRIGHT)}\n\n${colorCode}`;

    return {
        code,
        filename: "colors.sass",
        language
    };
}

function exportTextStyles(context) {
    const { code: textStyleCode, language } = textStyles(context);
    const code = `${comment(context, COPYRIGHT)}\n\n${textStyleCode}`;

    return {
        code,
        filename: "fonts.sass",
        language
    };
}

function styleguideColors(context, colorsInProject) {
    const params = getParams(context);
    const sassGenerator = createGenerator(context, params);

    return {
        code: colorsInProject.map(c => sassGenerator.variable(c.name, new Color(c))).join("\n"),
        language: LANG
    };
}

function styleguideTextStyles(context, textStyles) {
    const params = getParams(context);
    const sassGenerator = createGenerator(context, params);
    const fontFaces = getFontFaces(textStyles);

    const fontFaceCode = fontFaces.map(ts => {
        const { style } = new FontFace(ts);

        return sassGenerator.atRule(style);
    }).join("\n\n");

    const textStyleCode = textStyles.map(t => {
        const { style } = new TextStyle(t);

        return sassGenerator.ruleSet(style, { mixin: params.useMixin });
    }).join("\n\n");

    return {
        code: `${fontFaceCode}\n\n${textStyleCode}`,
        language: LANG
    };
}

function exportStyleguideColors(context, colorsInStyleguide) {
    const { code: colorCode, language } = styleguideColors(context, colorsInStyleguide);
    const code = `${comment(context, COPYRIGHT)}\n\n${colorCode}`;

    return {
        code,
        filename: "colors.sass",
        language
    };
}

function exportStyleguideTextStyles(context, textStylesInStyleguide) {
    const { code: textStyleCode, language } = styleguideTextStyles(context, textStylesInStyleguide);
    const code = `${comment(context, COPYRIGHT)}\n\n${textStyleCode}`;

    return {
        code,
        filename: "fonts.sass",
        language
    };
}

export default {
    colors,
    textStyles,
    layer,
    comment,
    exportColors,
    exportTextStyles,
    styleguideColors,
    styleguideTextStyles,
    exportStyleguideColors,
    exportStyleguideTextStyles
};
