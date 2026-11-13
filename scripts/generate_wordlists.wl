(* Generate clean 5-letter and 6-letter word lists for the Wordle-style game *)

isPlainLowerAlpha[w_String, n_Integer] :=
  StringLength[w] === n && StringMatchQ[w, RegularExpression["[a-z]+"]];

all5 = Sort@DeleteDuplicates@Select[DictionaryLookup[Repeated[_, {5}]], isPlainLowerAlpha[#, 5] &];
all6 = Sort@DeleteDuplicates@Select[DictionaryLookup[Repeated[_, {6}]], isPlainLowerAlpha[#, 6] &];

Export["scripts/wl_words5.txt", StringRiffle[all5, "\n"], "Text"];
Export["scripts/wl_words6.txt", StringRiffle[all6, "\n"], "Text"];

Print["Exported ", Length[all5], " 5-letter words and ", Length[all6], " 6-letter words."];


