const dictionary =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY";
const binary = dictionary.length;

function bitwise(str: string) {
	let hash = 0;
	if (str.length === 0) return hash;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		hash = (hash << 5) - hash + ch;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
}

export function shorthash(text: string) {
	let num: number;
	let result = "";

	let integer = bitwise(text);
	const sign = integer < 0 ? "Z" : ""; // If it's negative, start with Z, which isn't in the dictionary

	integer = Math.abs(integer);

	while (integer >= binary) {
		num = integer % binary;
		integer = Math.floor(integer / binary);
		result = dictionary[num] + result;
	}

	if (integer > 0) {
		result = dictionary[integer] + result;
	}

	return sign + result;
}

export function deterministicString(array: Array<string>) {
	//add the constructor as a key
	let ret = `(${array.constructor.name}:[`;

	//add all key/value pairs
	for (const [k, v] of array.entries()) {
		ret += `(${k}:${JSON.stringify(v)}),`;
	}

	ret += "])";

	return ret;
}