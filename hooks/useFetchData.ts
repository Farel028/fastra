import { firestore } from "@/config/firebase";
import {
  collection,
  onSnapshot,
  query,
  QueryConstraint,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";

const useFetchData = <T>(
  collectionName: string,
  contraints: QueryConstraint[] = [],
  refreshKey?: string | number,
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const constraintsRef = useRef<QueryConstraint[]>(contraints);

  const constraintsKey = useMemo(() => {
    try {
      return JSON.stringify(contraints);
    } catch {
      return `${contraints.length}`;
    }
  }, [contraints]);

  useEffect(() => {
    constraintsRef.current = contraints;
  }, [contraints]);

  useEffect(() => {
    if (!collectionName) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    let unsub = () => {};

    try {
      const collectionRef = collection(firestore, collectionName);
      const q = query(collectionRef, ...constraintsRef.current);

      unsub = onSnapshot(
        q,
        (snapshot) => {
          const fetchedData = snapshot.docs.map((doc) => {
            return {
              id: doc.id,
              ...doc.data(),
            };
          }) as T[];
          setData(fetchedData);
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        },
      );
    } catch (err: any) {
      setError(err?.message || "Failed to fetch data");
      setLoading(false);
    }

    return () => unsub();
  }, [collectionName, constraintsKey, refreshKey]);
  return { data, loading, error };
};

export default useFetchData;
