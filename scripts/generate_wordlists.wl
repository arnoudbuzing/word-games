(* Generate clean 4, 5, 6, and 7-letter word lists for the Wordle-style game *)

isPlainLowerAlpha[w_String, n_Integer] :=
  StringLength[w] === n && StringMatchQ[w, RegularExpression["[a-z]+"]];

Do[
  Module[{words},
    words = Sort@DeleteDuplicates@Select[DictionaryLookup[Repeated[_, {n}]], isPlainLowerAlpha[#, n] &];
    Export["scripts/wl_words" <> IntegerString[n] <> ".txt", StringRiffle[words, "\n"], "Text"];
    Print["Exported ", Length[words], " ", n, "-letter words."];
  ],
  {n, 4, 7}
];



