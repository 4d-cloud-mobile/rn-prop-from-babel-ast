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
        "Text": ["..", "Text", "TextProps.js"].join(path.sep),
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
        const typeAlias = findObjectOfTypeWithName(ast, "TypeAlias", fileType+"Props") || findObjectOfTypeWithName(ast, "TypeAlias", "Props"); // also add iOSProps and AndroidProps
        if (typeAlias && typeAlias.right.typeParameters) {
            const nodeProperties: any = typeAlias.right.typeParameters.params[0].properties;
            for(const nodeKey in nodeProperties) {
                const node: any = nodeProperties[nodeKey];
                if (node.value) {
                    let property: { [key: string]: any } = {}
                    if(node.value.type == "NullableTypeAnnotation") {
                        property["type"] = node.value.typeAnnotation.type
                        property["nullable"] = true
                    } else {
                        property["type"] = node.value.type; 
                    }
                    properties[node.key.name] = property
                }
            }
        }
        /*if (path.node.type == "ObjectTypeProperty")  {
            let property: { [key: string]: any } = {}
            if(path.node.value.type == "NullableTypeAnnotation") {
                property["type"] = path.node.value.typeAnnotation.type
                property["nullable"] = true
            } else {
                property["type"] = path.node.value.type; 
            }
            properties[path.node.key.name] = property

            console.log(path.parent)
        }*/
           
        properties["classFound"] = componentClassNode != null;
        properties["typeAliasFound"] = typeAlias != null;
        result[fileType] = properties;

    }
    const jsonString = JSON.stringify(result, null, 2);
    await fs.writeFile("components.json", jsonString);
}

// Call start
(async() => {
    const rootPath: string = ["node_modules", "react-native", "Libraries", "Components"].join(path.sep) + path.sep;
    await start(rootPath);
})();