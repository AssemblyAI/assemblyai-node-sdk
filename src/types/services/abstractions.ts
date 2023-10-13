/**
 * Interface for classes that can create resources.
 * @template T The type of the resource.
 * @template Parameters The type of the parameters required to create the resource.
 */
interface Createable<T, Parameters, Options = Record<string, unknown>> {
  /**
   * Create a new resource.
   * @param params The parameters of the new resource.
   * @param options The options used for creating the new resource.
   * @return A promise that resolves to the newly created resource.
   */
  create(params: Parameters, options?: Options): Promise<T>;
}

/**
 * Interface for classes that can retrieve resources.
 * @template T The type of the resource.
 * @template Id The type of the resource's identifier. Defaults to string.
 */
interface Retrieveable<T, Id = string> {
  /**
   * Get a resource.
   * @param id The identifier of the resource to retrieve.
   * @return A promise that resolves to the retrieved resource.
   */
  get(id: Id): Promise<T>;
}

/**
 * Interface for classes that can delete resources.
 * @template T The type of the resource.
 * @template Id The type of the resource's identifier. Defaults to string.
 */
interface Deletable<T, Id = string> {
  /**
   * Delete a resource.
   * @param id The identifier of the resource to delete.
   * @return A promise that resolves to a boolean indicating whether the deletion was successful.
   */
  delete(id: Id): Promise<T>;
}

/**
 * Interface for classes that can list resources.
 * @template T The type of the resource.
 */
interface Listable<T, Page = string> {
  /**
   * List all resources.
   * @return A promise that resolves to an array of resources.
   */
  list(page?: Page): Promise<T>;
}

export type { Createable, Retrieveable, Deletable, Listable };
