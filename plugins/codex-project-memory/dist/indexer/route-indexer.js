const METHOD_DECORATORS = {
    Get: "GET",
    Post: "POST",
    Put: "PUT",
    Patch: "PATCH",
    Delete: "DELETE"
};
export function inferNestRoutes(sourceFile, symbols) {
    const routes = [];
    for (const cls of sourceFile.getClasses()) {
        const controller = cls.getDecorator("Controller");
        if (!controller) {
            continue;
        }
        const prefix = getDecoratorStringArg(controller) ?? "";
        for (const method of cls.getMethods()) {
            const decorator = method.getDecorators().find((item) => METHOD_DECORATORS[item.getName()]);
            if (!decorator) {
                continue;
            }
            const methodPath = getDecoratorStringArg(decorator) ?? "";
            const handlerFqName = `${cls.getName() ?? "Anonymous"}.${method.getName()}`;
            const handler = symbols.find((symbol) => symbol.fqName === handlerFqName);
            routes.push({
                method: METHOD_DECORATORS[decorator.getName()],
                path: normalizeRoutePath(prefix, methodPath),
                handlerSymbolId: handler?.id,
                moduleId: undefined
            });
        }
    }
    return routes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}
function getDecoratorStringArg(decorator) {
    const text = decorator.getArguments()[0]?.getText();
    if (!text) {
        return "";
    }
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        return text.slice(1, -1);
    }
    return null;
}
function normalizeRoutePath(prefix, methodPath) {
    return `/${prefix}/${methodPath}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}
//# sourceMappingURL=route-indexer.js.map