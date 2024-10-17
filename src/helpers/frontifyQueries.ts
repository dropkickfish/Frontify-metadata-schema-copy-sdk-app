import { AppBridgePlatformApp } from "@frontify/app-bridge-app"

const appBridge = new AppBridgePlatformApp();

type CreateMetadataInput = {
    parentId: string;
    name: string;
    type: CreateCustomMetadataPropertyTypeInput
  };

type CreateCustomMetadataPropertyOption = {
    value: string;
}

type CreateCustomMetadataPropertyTypeInput = {
  name: string;
  options?: CreateCustomMetadataPropertyOption[];
};

type CreateCustomMetadataPropertyOptionsInput = {
    propertyId: string;
    options: CreateCustomMetadataPropertyOption[]
}

export const getLibraries = async () => {
    const query = `
    query Libraries($libraryPage: Int!) {
        brands {
            name
            id
            libraries(limit: 100, page: $libraryPage) {
            items {
                customMetadataProperties{
                  id
                }
                id
                name
            }
            hasNextPage
            }
        }
    }
    `;
    
    const variables = {
        libraryPage: 1
    };
    const libraries = [];
    const data = await appBridge.api({
        name: 'executeGraphQl',
        payload: { query, variables },
    });
    let page = 1;
    for (const brand of data.brands) {
        if (brand.libraries.items.length > 0) {
            for (const library of brand.libraries.items) {
                if (library.customMetadataProperties.length > 0) {
                    libraries.push(library);
                }
            }
        }
        if (brand.libraries.hasNextPage) {
            // if hasNextPage is true, fetch the next page
            ++page;
            const nextLibraries = await getLibraryPage(brand.id, page)
            if (nextLibraries.length > 0){
                for (const library of nextLibraries) {
                    if (library.customMetadataProperties.length > 0) {
                        libraries.push(library);
                    }
                }
            }
        }
    }
    console.log(libraries)
    return libraries
}

export const getMetadataFields = async (libraryId: string) => {
    console.log('in get func', libraryId)
    const metadataFields = [];
    const query = `
    query GetLibraryCustomMetadataProperties($libraryId: ID!) {
        library(id: $libraryId) {
            customMetadataProperties {
            ... on CustomMetadataProperty {
                id
                defaultValue
                name
                type {
                ... on CustomMetadataPropertyType {
                    name
                    ... on CustomMetadataPropertyTypeSelect {
                    options {
                        id
                        value
                    }
                    }
                    ...on CustomMetadataPropertyTypeMultiSelect{
                    options{
                        id
                        value
                    }
                    }
                }
                }
            }
            }
        }
    }
    `;
    const variables = {
        libraryId
    };
    const data = await appBridge.api({
        name: 'executeGraphQl',
        payload: { query, variables },
    });
    console.log(data)
    if (data.library !== null) {
        for (const field of data.library.customMetadataProperties) {
            const id = field.id;
            const name = field.name;
            const type = field.type.name;
            let options: CreateCustomMetadataPropertyOption[] = [];
            if (type === 'SELECT' || type === 'MULTISELECT') {
                try {
                    options = field.type.options.map((option: { value: string; }) => option.value);
                } catch (error) {
                    options = [];
                    console.error("Error mapping options:", error);
                    continue;
                }
            }
            const metadataField: any = {id, name, type};
            if (options.length > 0) {
                metadataField['options'] = options;
            }
            metadataFields.push(metadataField);
        }
        console.log('metadataFields', metadataFields)
        return metadataFields;
    }
}

const getLibraryPage = async (brand: string, page: number) => {
    const query = `
    query brandLibraryPage($brand: ID!, $page: Int!) {
    brand(id: $brand) {
        libraries(page: $page, limit: 100) {
        items {
            id
            name
        }
        hasNextPage
        }
    }
    }
`;

    const variables = {"brand": brand, "page": page};

    const { data } = await appBridge.api({
        name: 'executeGraphQl',
        payload: { query, variables },
    });

    if (data.brand.libraries.hasNextPage) {
        // if hasNextPage is true, fetch the next page
        ++page;
        await getLibraryPage(brand, page);
    }

    return data.brand.libraries.items;
}

const constructSelectFieldOptions = (options: string[]) => {
    return options.map(str => ({ value: str }));
}

const createNewMetadataField = async (parentId: string, field) => {
    console.log('Creating new field:', field.name, 'with type:', field.type);

    const query = `
        mutation createMetaProperty($input: CreateCustomMetadataPropertyInput!) {
            createCustomMetadataProperty(input: $input) {
                property {
                    id
                }
            }
        }
    `;

    const input: CreateMetadataInput = {
        parentId,
        name: field.name,
        type: {
            name: field.type
        }
    };

    if (field.type === 'SELECT' || field.type === 'MULTISELECT') {
        input.type.options = constructSelectFieldOptions(field.options);
    }
    const data = await appBridge.api({
        name: 'executeGraphQl',
        payload: {
            query,
            variables: { input }
        }
    });

    console.log('New field created:', data);
}


export const createNewMetadataFields = async (parentId: string, metadataFields: any[], selectedFields: any[], selectedOptions: any) => {
    const query = `
    mutation createMetaProperty($input: CreateCustomMetadataPropertyInput!) {
    createCustomMetadataProperty(input: $input) {
        property {
        id
        }
    }
    }
`;
    const fields = constructSelectedFields(metadataFields, selectedFields, selectedOptions);
    for (const field of fields) {
        const input: CreateMetadataInput = {
            parentId,
            name: field.name,
            type: {
                name: field.type
            }
        };;
        if (field.type === 'SELECT' || field.type === 'MULTISELECT') {
            input.type.options = constructSelectFieldOptions(field.options);
        }
        const data = await appBridge.api({
            name: 'executeGraphQl',
            payload: {
                query,
                variables: {
                    input
                }
            }
        });

    console.log(data)}
}

const constructSelectedFields = (metadataFields: any[], selectedFields: any[], selectedOptions: any) => {
    const fields = [];
    for (const selectedField of selectedFields) {
        const field = metadataFields.find(field => field.id === selectedField);
        if (field.type === 'SELECT' || field.type === 'MULTISELECT') {
            field.options = selectedOptions[selectedField];
        }
        fields.push(field);
    }
    console.log('selectedFields after construction', fields)
    return fields;
}

export const checkExistingMetadataFields = async (parentId, metadataFields, selectedFields, selectedOptions) => {
    const fields = constructSelectedFields(metadataFields, selectedFields, selectedOptions);

    const query = `
        query LibraryMetadataFields($libraryId: ID!) {
            library(id: $libraryId) {
                customMetadataProperties {
                    id
                    name
                    type {
                        name
                        ... on CustomMetadataPropertyTypeSelect {
                            options {
                                id
                                value
                            }
                        }
                        ... on CustomMetadataPropertyTypeMultiSelect {
                            options {
                                id
                                value
                            }
                        }
                    }
                }
            }
        }
    `;
    const variables = {
        libraryId: parentId,
    };
    const data = await appBridge.api({
        name: 'executeGraphQl',
        payload: {
            query,
            variables
        }
    });
    console.log("Checked existing fields", data);

    if (data.library.customMetadataProperties.length > 0) {
        const existingFieldsMap = new Map();

        for (const existingField of data.library.customMetadataProperties) {
            existingFieldsMap.set(existingField.name, existingField);
        }

        console.log('Existing Fields:', existingFieldsMap);

        for (const field of fields) {
            const existingField = existingFieldsMap.get(field.name.trim());
            if (existingField) {
                console.log('Field exists:', existingField);
                // Field with the same name exists
                const existingFieldTypeName = existingField.type.name;
                const fieldTypeName = field.type;

                console.log('Existing Field Type Name:', existingFieldTypeName);
                console.log('Field Type Name:', fieldTypeName);

                if (existingFieldTypeName === fieldTypeName) {
                    if (fieldTypeName === 'SELECT' || fieldTypeName === 'MULTISELECT') {
                        // Ensure options are arrays of strings
                        const existingOptions = existingField.type.options.map(option => option.value);
                        const newOptions = field.options;

                        console.log('Existing Options:', existingOptions);
                        console.log('New Options:', newOptions);

                        // Calculate the difference
                        const diff = newOptions.filter(option => !existingOptions.includes(option));

                        console.log('Options to add:', diff);

                        if (diff.length > 0) {
                            const options = constructSelectFieldOptions(diff);
                            await createNewOptions(existingField.id, options);
                        }
                    }
                    // Types match but are not SELECT or MULTISELECT, no action needed
                } else {
                    console.log('Creating new field because types do not match.');
                    await createNewMetadataField(parentId, field);
                }
            } else {
                console.log('Creating new field because field does not exist.');
                console.log('Field:', field);
                await createNewMetadataField(parentId, field);
            }
        }
    } else {
        console.log('There are no existing fields in the library');
        await createNewMetadataFields(parentId, metadataFields, selectedFields, selectedOptions);
    }
};



const createNewOptions = async (propertyId: string, options: CreateCustomMetadataPropertyOption[]) => {
    const input: CreateCustomMetadataPropertyOptionsInput = {
        propertyId: propertyId,
        options: options
    };
    const query = `
    mutation CreateNewMetadataOptions($input: AddCustomMetadataPropertyOptionsInput!) {
    addCustomMetadataPropertyOptions(input: $input) {
        customMetadataProperty{
        id
        name
        }
    }
    }`;
    console.log('creating new options ', options, ' for property ', propertyId)
    const data = await appBridge.api({
        name: 'executeGraphQl',
        payload: {
            query,
            variables: {
                input
            }
        }
    });
    console.log(data)
};
