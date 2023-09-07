module Description exposing (main)

import Browser
import Html exposing (Html, code, div, p, text)


main : Program String Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }


type alias Model =
    { message : String
    }


init : String -> ( Model, Cmd Msg )
init initialMesssage =
    ( { message = initialMesssage }, Cmd.none )


type Msg
    = Name String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Name name ->
            ( { model | message = name }, Cmd.none )


view : Model -> Html Msg
view model =
    div
        []
        [ p []
            [ text model.message ]
        , p
            []
            [ text "The above sentence is passed via init flags. But this and following message is written in Description.gren. By editing them in dev, HMR should be triggered."
            ]
        , p
            []
            [ text "vite-plugin-gren can import multiple main files with using "
            , code [] [ text "with" ]
            , text " URL query parameter like "
            , code [] [ text "import First.gren?with=Second.gren&with=Third.gren" ]
            , text ". This triggers single compilation involving all given .gren files with their dependencies."
            , text " An exported Gren object will have keys with each name so you can access them by 'Gren.First', 'Gren.Second', and 'Gren.Third'."
            ]
        ]


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.none
