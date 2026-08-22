/**
 * Design Token to CSS Variables Converter
 * 
 * This script reads the design system information from `design-tokens.tokens.json`
 * and converts it into a structured CSS file containing CSS variables.
 * 
 * Key Features:
 * - Differentiates between 'Primitive Colors' (foundations) and 'Color Roles' (UI applied).
 * - Resolves Figma Token references (e.g., {path.to.token}) into CSS variable references (var(--path-to-token)).
 * - Formats token keys to kebab-case (e.g., 'Primary Color' -> 'primary-color').
 * - Handles custom object structures like Typography or Custom Shadows.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const inputPath = path.join(__dirname, 'design-tokens.tokens.json');
const outputPath = path.join(__dirname, 'design-tokens.css');

/**
 * Utility: Convert strings with spaces/dots to kebab-case
 * Example: 'primitive colors.key color group' -> 'primitive-colors-key-color-group'
 */
function toKebabCase(str) {
  return str
    .replace(/\./g, '-') // Replace dots with hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // Handle camelCase
    .toLowerCase();
}

/**
 * Format specific types of values (like custom-shadow objects) into valid CSS values
 */
function formatValue(value, type) {
  // If the value is a reference like {color.primary}, convert to CSS var: var(--color-primary)
  if (typeof value === 'string' && value.includes('{')) {
    return value.replace(/\{([^}]+)\}/g, (match, tokenPath) => {
      const cssVarName = toKebabCase(tokenPath);
      return `var(--${cssVarName})`;
    });
  }

  // Handle Box Shadows
  if (type === 'custom-shadow') {
    const formatShadow = (shadow) => {
      const inset = shadow.shadowType === 'innerShadow' ? 'inset ' : '';
      return `${inset}${shadow.offsetX}px ${shadow.offsetY}px ${shadow.radius}px ${shadow.spread}px ${shadow.color}`;
    };
    if (Array.isArray(value)) {
      return value.map(formatShadow).join(', ');
    }
    return formatShadow(value);
  }

  // Handle Typography or other objects by stringifying them (fallback)
  if (typeof value === 'object' && value !== null) {
    // If it's a typography object, we might want to flatten it,
    // but in case it hits here, let's just warn and stringify.
    return Object.values(value).join(' '); // Basic fallback
  }

  // Dimension tokens (spacing, font size, line height, letter spacing, etc.)
  // are stored as bare numbers. CSS requires a unit wherever they're used
  // directly (padding, font-size, ...), so append px here rather than at
  // every call site.
  if (type === 'dimension' && typeof value === 'number') {
    return `${value}px`;
  }

  return value;
}

/**
 * Recursively flatten the JSON tree into a single-level dictionary of tokens
 */
function flattenTokens(obj, prefix = '') {
  let tokens = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      const safeKey = toKebabCase(key);

      // A token is defined by having a 'value' property
      if (val !== null && typeof val === 'object' && val.hasOwnProperty('value')) {
        // If the value is an object but not a shadow, we flatten its properties
        // For example, Typography could be { fontFamily: "Inter", fontSize: "16px" }
        if (typeof val.value === 'object' && val.type !== 'custom-shadow') {
          for (const innerKey in val.value) {
            tokens[`${prefix}${safeKey}-${toKebabCase(innerKey)}`] = {
              type: val.type,
              value: val.value[innerKey],
              description: val.description
            };
          }
        } else {
          tokens[`${prefix}${safeKey}`] = val;
        }
      } else if (val !== null && typeof val === 'object') {
        // Recursive call for nested groups
        const newPrefix = prefix + safeKey + '-';
        Object.assign(tokens, flattenTokens(val, newPrefix));
      }
    }
  }

  return tokens;
}

/**
 * Main execution script
 */
function generateCSS() {
  try {
    // 1. Read and parse the design tokens JSON file
    console.log(`Reading tokens from ${inputPath}...`);
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const designTokens = JSON.parse(rawData);

    // 2. Process and categorize tokens
    // We separate primitive colors, color roles, and others to create well-documented sections in the CSS
    let cssContent = `/**\n * DESIGN SYSTEM TOKENS\n * Auto-generated from design-tokens.tokens.json\n */\n\n:root {\n`;

    const sections = {
      'Primitive Colors': 'primitive colors',
      'Color Roles': 'color roles',
      'Typography': 'typography',
      'Spacing': 'spacing collection',
      'Effects': 'effect'
    };

    for (const [sectionTitle, jsonKey] of Object.entries(sections)) {
      if (designTokens[jsonKey]) {
        cssContent += `  /* ==========================================\n`;
        cssContent += `     ${sectionTitle.toUpperCase()}\n`;
        if (sectionTitle === 'Primitive Colors') {
          cssContent += `     Foundations of the color system. Do NOT apply directly to UI.\n`;
        }
        if (sectionTitle === 'Color Roles') {
          cssContent += `     Semantic colors meant to be applied on the UI components.\n`;
        }
        cssContent += `     ========================================== */\n`;

        // Flatten the specific section
        const flattened = flattenTokens(designTokens[jsonKey], `${toKebabCase(jsonKey)}-`);
        
        for (const [tokenName, tokenData] of Object.entries(flattened)) {
          const cssValue = formatValue(tokenData.value, tokenData.type);
          
          if (tokenData.description) {
            cssContent += `  /* ${tokenData.description} */\n`;
          }
          cssContent += `  --${tokenName}: ${cssValue};\n`;
        }
        cssContent += `\n`;
      }
    }

    cssContent += `}\n`;

    // 3. Write to the CSS file
    fs.writeFileSync(outputPath, cssContent, 'utf8');
    console.log(`\nSuccess! CSS variables have been generated at ${outputPath}`);
    
  } catch (error) {
    console.error('Error generating CSS:', error);
  }
}

// Run the script
generateCSS();
