export type CategoryNode = {
    id: number;
    name: string;
    parentId?: number | null;
    children?: CategoryNode[];
};

export type CategoryOption = {
    id: number;
    name: string;
    label: string;
};

export const flattenCategoryTree = (
    categories: CategoryNode[],
    prefix = ''
): CategoryOption[] =>
    categories.flatMap((category) => {
        const label = prefix ? `${prefix} > ${category.name}` : category.name;
        return [
            { id: category.id, name: category.name, label },
            ...flattenCategoryTree(category.children ?? [], label),
        ];
    });
