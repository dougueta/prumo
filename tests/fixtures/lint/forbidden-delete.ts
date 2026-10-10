// Fixture de lint (004 · T065): DELETE físico em tabela core é proibido em qualquer lugar.
declare const client: { from(table: string): { delete(): unknown } };

export const removed = client.from("transactions").delete();
