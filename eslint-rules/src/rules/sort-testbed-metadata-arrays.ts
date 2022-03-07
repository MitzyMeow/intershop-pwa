import { TSESLint, TSESTree } from '@typescript-eslint/experimental-utils';

import { normalizePath } from '../helpers';

export const sortTestbedMetadataArraysRule: TSESLint.RuleModule<string, []> = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      sortTestBedMetadataArrays: '`TestBed` metadata arrays should be sorted in ASC alphabetical order',
    },
  },
  create(context) {
    function getText(node) {
      return context.getSourceCode().getText(node);
    }

    if (!normalizePath(context.getFilename()).endsWith('.spec.ts')) {
      return {};
    }

    return {
      'CallExpression[callee.object.name="TestBed"][callee.property.name="configureTestingModule"] > ObjectExpression > Property[key.name!="providers"] > ArrayExpression'({
        elements,
      }: TSESTree.ArrayExpression) {
        // logic from https://github.com/angular-eslint/angular-eslint/blob/master/packages/eslint-plugin/src/rules/sort-ngmodule-metadata-arrays.ts

        const unorderedNodes = elements
          .map((current, index, list) => [current, list[index + 1]])
          .find(([current, next]) => {
            return next && getText(current).localeCompare(getText(next)) === 1;
          });

        if (!unorderedNodes) return;

        const [unorderedNode, nextNode] = unorderedNodes;
        context.report({
          node: nextNode,
          messageId: 'sortTestBedMetadataArrays',
          fix: fixer => [
            fixer.replaceText(unorderedNode, getText(nextNode)),
            fixer.replaceText(nextNode, getText(unorderedNode)),
          ],
        });
      },
    };
  },
};
