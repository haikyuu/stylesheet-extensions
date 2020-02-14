import { STYLE_PROPS } from "../constants";

class Height {
    constructor(length) {
        this.value = length;
    }

    get name() {
        return STYLE_PROPS.HEIGHT;
    }

    equals(other) {
        return this.value.equals(other.value);
    }

    getValue(params, variables) {
        return this.value.toStyleValue(Object.assign({}, params, { useRemUnit: false }), variables);
    }
}

export default Height;