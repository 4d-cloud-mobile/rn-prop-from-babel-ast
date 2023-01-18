const fs = require('fs').promises;
const path = require('path');
const parser = require("@babel/parser");
const _traverse = require("@babel/traverse");
const traverse = _traverse.default;

function findObjectOfTypeWithName(ast: any, type: string, name: string): any {
    var clazz: any
    traverse(ast, {
        enter (path: any) {
            if ((path.node.type == type) && (path.node.id.name == name)) {
                clazz = path.node
                // XXX break traverse?
            }
        }
    });
    return clazz;
}

function stringOfType(property: { [key: string]: any; }, node: any): string {
    if (typeof node.value == "object") {
        return stringOfType(property, node.value);
    }
    if (node.type == "NullableTypeAnnotation") {
        property["nullable"] = true;
        if (node.typeAnnotation) {
            return stringOfType(property, node.typeAnnotation);
        } else {
            return "ERROR";
        }
    } else if (node.type == "GenericTypeAnnotation") {
        if (node && node.id.name) {
            return node.id.name;
        } if (node && node.typeParameters) {
            return stringOfType(property, node.typeParameters)
        } else {
            return "ERROR: Generic without id.name or typeParameters "+JSON.stringify(node);
        }
    } else if (node.type == "UnionTypeAnnotation") {
        property["union"] = true;
        if (node.types) {
            return (node.types as any[]).map(item => {
                return stringOfType(property, item)
            }).filter((n, i, arr) => arr.indexOf(n) === i).join("|")
        } else {
            return "ERROR: Union without types key";
        }
    } else if (node.id) {
        return node.id.type;
    } else if (node.type) {
        return node.type;
    } else {
        return "ERROR: " + JSON.stringify(node);
    }
}

function addPropertiesFrom(typeAlias: any, properties: { [key: string]: any; }, callback: ((prop: any) => void) | null = null) {
    if (typeAlias && typeAlias.right) {
        const nodeProperties: any = (typeAlias.right.typeParameters) ? typeAlias.right.typeParameters.params[0].properties : typeAlias.right.properties;
        if (nodeProperties)  {
            for (const nodeKey in nodeProperties) {
                const node: any = nodeProperties[nodeKey];
                if (node.value) {
                    let property: { [key: string]: any; } = {};
                    property["type"] = stringOfType(property, node);
                    if (callback) {
                        callback(property);
                    }
                    properties[node.key.name] = property;
                }
            }
        }
    }
}

async function start(rootPath: string) {
    const files: { [key: string]: string } = {
        "ActivityIndicator": ["ActivityIndicator", "ActivityIndicator.js"].join(path.sep),
        "Switch": ["Switch", "Switch.js"].join(path.sep),
        "RefreshControl": ["RefreshControl", "RefreshControl.js"].join(path.sep),
        "Slider": ["Slider", "Slider.js"].join(path.sep),
        "Pressable": ["Pressable", "Pressable.js"].join(path.sep),
        "ScrollView": ["ScrollView", "ScrollView.js"].join(path.sep),
        "Clipboard": ["Clipboard", "Clipboard.js"].join(path.sep),
        "TextInput": ["TextInput", "TextInput.js"].join(path.sep),
        "Touchable": ["Touchable", "Touchable.js"].join(path.sep),
        "View": ["View", "View.js"].join(path.sep),
        "StaticRenderer": ["StaticRenderer.js"].join(path.sep),
        "Image": ["..", "Image", "ImageProps.js"].join(path.sep),
        "ImageBackground": ["..", "Image", "ImageProps.js"].join(path.sep),
        "Text": ["..", "Text", "TextProps.js"].join(path.sep),
        "FlatList": ["..", "Lists", "FlatList.js"].join(path.sep),
        "VirtualizedList": ["..", "Lists", "VirtualizedListProps.js"].join(path.sep),
        "SectionList": ["..", "Lists", "SectionList.js"].join(path.sep),
        "Button": "Button.js"
    };
    let result: { [key: string]: any } = {}
    for (const fileType in files) {
        var filePath = rootPath + files[fileType];
 
        const data = await fs.readFile(filePath);
        var code = data.toString('utf8');
    
        const ast = parser.parse(code, {
            sourceType: "module",
            plugins: ["jsx","flow"]
        });
        
        let properties: { [key: string]: any } = {}

        const componentClassNode = findObjectOfTypeWithName(ast, "ClassDeclaration", fileType) || findObjectOfTypeWithName(ast, "ClassDeclaration", fileType + "WithRef");
        properties["classFound"] = componentClassNode != null;

        let typeAlias = findObjectOfTypeWithName(ast, "TypeAlias", fileType+"Props") || findObjectOfTypeWithName(ast, "TypeAlias", "Props");
        properties["typeAliasFound"] = typeAlias != null;
        addPropertiesFrom(typeAlias, properties);

        typeAlias = findObjectOfTypeWithName(ast, "TypeAlias", "AndroidProps") || findObjectOfTypeWithName(ast, "TypeAlias", "Android" + fileType + "Props"); 
        addPropertiesFrom(typeAlias, properties, (prop: any) : void => {
            prop["android"]=true 
        });
      
        typeAlias = findObjectOfTypeWithName(ast, "TypeAlias", "IOSProps") || findObjectOfTypeWithName(ast, "TypeAlias", "IOS" + fileType + "Props")
        addPropertiesFrom(typeAlias, properties, (prop: any) : void => {
            prop["ios"]=true 
        });

        typeAlias = findObjectOfTypeWithName(ast, "TypeAlias", "OptionalProps")
        addPropertiesFrom(typeAlias, properties, (prop: any) : void => {
            prop["optional"]=true 
        });

        typeAlias = findObjectOfTypeWithName(ast, "TypeAlias", "RequiredProps")
        addPropertiesFrom(typeAlias, properties, (prop: any) : void => {
            prop["required"]=true 
        });

        result[fileType] = properties;
    }
    console.log("Number of components: " + Object.keys(result).length);
    const jsonString = JSON.stringify(result, null, 2);
    await fs.writeFile("components.json", jsonString);
    console.log("Info writed to components.json");
}

// Call start
(async() => {
    const rootPath: string = ["node_modules", "react-native", "Libraries", "Components"].join(path.sep) + path.sep;
    await start(rootPath);
})();